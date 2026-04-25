/**
 * Unit tests for pages tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listPagesTool,
  selectPageTool,
  navigatePageTool,
  newPageTool,
  closePageTool,
  handleNavigatePage,
  handleNewPage,
} from '../../src/tools/pages.js';

const mockGetFirefox = vi.hoisted(() => vi.fn());

vi.mock('../../src/index.js', () => ({
  getFirefox: () => mockGetFirefox(),
}));

describe('Pages Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Definitions', () => {
    it('should have correct tool names', () => {
      expect(listPagesTool.name).toBe('list_pages');
      expect(selectPageTool.name).toBe('select_page');
      expect(navigatePageTool.name).toBe('navigate_page');
      expect(newPageTool.name).toBe('new_page');
      expect(closePageTool.name).toBe('close_page');
    });

    it('should have valid descriptions', () => {
      expect(listPagesTool.description).toContain('tab');
      expect(selectPageTool.description).toContain('Select');
      expect(navigatePageTool.description).toContain('Navigate');
      expect(newPageTool.description).toContain('new');
      expect(closePageTool.description).toContain('Close');
    });

    it('should have valid input schemas', () => {
      expect(listPagesTool.inputSchema.type).toBe('object');
      expect(selectPageTool.inputSchema.type).toBe('object');
      expect(navigatePageTool.inputSchema.type).toBe('object');
      expect(newPageTool.inputSchema.type).toBe('object');
      expect(closePageTool.inputSchema.type).toBe('object');
    });
  });

  describe('Schema Properties', () => {
    it('selectPageTool should accept pageIdx, url, or title', () => {
      const { properties } = selectPageTool.inputSchema;
      expect(properties).toBeDefined();
      expect(properties?.pageIdx).toBeDefined();
      expect(properties?.url).toBeDefined();
      expect(properties?.title).toBeDefined();
      expect(properties?.callerId).toBeDefined();
    });

    it('navigatePageTool should require url', () => {
      const { properties } = navigatePageTool.inputSchema;
      expect(properties).toBeDefined();
      expect(properties?.url).toBeDefined();
      expect(properties?.url.type).toBe('string');
      expect(properties?.callerId).toBeDefined();
    });

    it('newPageTool should accept url', () => {
      const { properties } = newPageTool.inputSchema;
      expect(properties).toBeDefined();
      expect(properties?.url).toBeDefined();
      expect(properties?.callerId).toBeDefined();
    });

    it('closePageTool should require pageIdx', () => {
      const { properties, required } = closePageTool.inputSchema;
      expect(properties).toBeDefined();
      expect(properties?.pageIdx).toBeDefined();
      expect(properties?.callerId).toBeDefined();
      expect(required).toContain('pageIdx');
    });
  });

  describe('Caller-aware handlers', () => {
    it('should deny agent navigation into the human workspace by default', async () => {
      mockGetFirefox.mockResolvedValue({
        refreshTabs: vi.fn().mockResolvedValue(undefined),
        getTabs: vi.fn().mockReturnValue([{ title: 'Human Tab', url: 'about:blank' }]),
        getSelectedTabIdx: vi.fn().mockReturnValue(0),
        navigate: vi
          .fn()
          .mockRejectedValue(
            new Error(
              'Caller "agent-b" is not allowed to act in the human workspace without explicit approval'
            )
          ),
      });

      const result = await handleNavigatePage({
        url: 'https://example.com',
        workspaceId: 'human',
        callerId: 'agent-b',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('not allowed to act in the human workspace');
    });

    it('should deny creating a page in another agent workspace by default', async () => {
      mockGetFirefox.mockResolvedValue({
        createNewPage: vi
          .fn()
          .mockRejectedValue(
            new Error('Caller "agent-b" is not allowed to act in workspace "agent-a" by default')
          ),
      });

      const result = await handleNewPage({
        url: 'https://example.com',
        workspaceId: 'agent-a',
        callerId: 'agent-b',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('not allowed to act in workspace "agent-a"');
    });
  });
});
