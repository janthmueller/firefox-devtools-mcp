/**
 * Unit tests for text extraction tools
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractTextTool, handleExtractText } from '../../src/tools/text-extraction.js';

const mockExtractText = vi.hoisted(() => vi.fn());
const mockGetFirefox = vi.hoisted(() => vi.fn());

vi.mock('../../src/index.js', () => ({
  getFirefox: () => mockGetFirefox(),
}));

describe('Text Extraction Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFirefox.mockResolvedValue({
      extractText: mockExtractText,
    });
  });

  describe('Tool Definitions', () => {
    it('should have correct tool name', () => {
      expect(extractTextTool.name).toBe('extract_text');
    });

    it('should have valid description', () => {
      expect(extractTextTool.description).toContain('Extract text');
    });

    it('should have valid input schema', () => {
      expect(extractTextTool.inputSchema.type).toBe('object');
    });
  });

  describe('Schema Properties', () => {
    it('should support scope, source, and maxLength', () => {
      const { properties } = extractTextTool.inputSchema;
      expect(properties?.scope).toBeDefined();
      expect(properties?.source).toBeDefined();
      expect(properties?.maxLength).toBeDefined();
    });

    it('should support selector and uid scoping', () => {
      const { properties } = extractTextTool.inputSchema;
      expect(properties?.selector).toBeDefined();
      expect(properties?.uid).toBeDefined();
    });
  });

  describe('handleExtractText', () => {
    it('should extract rendered page text by default', async () => {
      mockExtractText.mockResolvedValue('Visible page text');

      const result = await handleExtractText({});

      expect(mockExtractText).toHaveBeenCalledWith(
        {
          scope: 'page',
          source: 'rendered',
        },
        undefined
      );
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Visible page text');
    });

    it('should support selector-scoped DOM extraction', async () => {
      mockExtractText.mockResolvedValue('Scoped DOM text');

      const result = await handleExtractText({
        scope: 'selector',
        selector: '#content',
        source: 'dom',
      });

      expect(mockExtractText).toHaveBeenCalledWith(
        {
          scope: 'selector',
          selector: '#content',
          source: 'dom',
        },
        undefined
      );
      expect(result.content[0].text).toContain('scope=selector');
      expect(result.content[0].text).toContain('source=dom');
    });

    it('should truncate output when maxLength is exceeded', async () => {
      mockExtractText.mockResolvedValue('abcdefghij');

      const result = await handleExtractText({ maxLength: 5 });

      expect(result.content[0].text).toContain('truncated=true');
      expect(result.content[0].text).toContain('[... truncated]');
    });

    it('should return an error when selector scope is missing selector', async () => {
      const result = await handleExtractText({ scope: 'selector' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('selector parameter is required');
    });
  });
});
