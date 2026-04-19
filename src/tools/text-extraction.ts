/**
 * Read-only text extraction tools
 */

import { errorResponse, successResponse, TOKEN_LIMITS } from '../utils/response-helpers.js';
import { handleUidError } from '../utils/uid-helpers.js';
import type { McpToolResponse } from '../types/common.js';
import type { ExtractTextScope, ExtractTextSource } from '../firefox/types.js';

const DEFAULT_MAX_LENGTH = 20_000;
const WORKSPACE_ID_SCHEMA = {
  type: 'string',
  description: 'Workspace identifier. Defaults to the human workspace when omitted.',
} as const;

export const extractTextTool = {
  name: 'extract_text',
  description: 'Extract text from the current page or a scoped region.',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['page', 'selector', 'uid'],
        description: 'Extraction scope (default: page)',
      },
      selector: {
        type: 'string',
        description: 'CSS selector used when scope="selector"',
      },
      uid: {
        type: 'string',
        description: 'Element UID used when scope="uid"',
      },
      source: {
        type: 'string',
        enum: ['rendered', 'dom'],
        description: 'Text source (default: rendered)',
      },
      maxLength: {
        type: 'number',
        description: 'Maximum characters to return (default: 20000)',
      },
      workspaceId: WORKSPACE_ID_SCHEMA,
    },
  },
};

export async function handleExtractText(args: unknown): Promise<McpToolResponse> {
  try {
    const {
      scope = 'page',
      selector,
      uid,
      workspaceId,
      source = 'rendered',
      maxLength: requestedMaxLength = DEFAULT_MAX_LENGTH,
    } = (args as {
      scope?: ExtractTextScope;
      selector?: string;
      uid?: string;
      workspaceId?: string;
      source?: ExtractTextSource;
      maxLength?: number;
    }) || {};

    if (!['page', 'selector', 'uid'].includes(scope)) {
      throw new Error('scope must be one of: page, selector, uid');
    }

    if (!['rendered', 'dom'].includes(source)) {
      throw new Error('source must be one of: rendered, dom');
    }

    if (scope === 'selector' && (!selector || typeof selector !== 'string')) {
      throw new Error('selector parameter is required when scope="selector"');
    }

    if (scope === 'uid' && (!uid || typeof uid !== 'string')) {
      throw new Error('uid parameter is required when scope="uid"');
    }

    if (!Number.isFinite(requestedMaxLength) || requestedMaxLength < 1) {
      throw new Error('maxLength must be a positive number');
    }

    const maxLength = Math.min(Math.floor(requestedMaxLength), TOKEN_LIMITS.MAX_RESPONSE_CHARS);
    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    const extractOptions: {
      scope: ExtractTextScope;
      source: ExtractTextSource;
      selector?: string;
      uid?: string;
    } = {
      scope,
      source,
    };

    if (selector) {
      extractOptions.selector = selector;
    }
    if (uid) {
      extractOptions.uid = uid;
    }

    let extractedText: string;
    try {
      extractedText = await firefox.extractText(extractOptions, workspaceId);
    } catch (error) {
      if (scope === 'uid' && uid) {
        throw handleUidError(error as Error, uid);
      }
      throw error;
    }

    const truncated = extractedText.length > maxLength;
    const outputText = truncated ? extractedText.slice(0, maxLength) : extractedText;
    let output = `Extracted text [scope=${scope} source=${source} length=${extractedText.length}`;
    if (truncated) {
      output += ` returned=${outputText.length} truncated=true`;
    }
    output += ']\n\n';
    output += outputText;

    if (truncated) {
      output += '\n\n[... truncated]';
    }

    return successResponse(output);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
