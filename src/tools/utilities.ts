/**
 * Page utility tools (dialogs, history, viewport)
 */

import { successResponse, errorResponse } from '../utils/response-helpers.js';
import type { McpToolResponse } from '../types/common.js';

const WORKSPACE_ID_SCHEMA = {
  type: 'string',
  description: 'Workspace identifier. Defaults to the human workspace when omitted.',
} as const;

// Tool definitions - Dialogs
export const acceptDialogTool = {
  name: 'accept_dialog',
  description: 'Accept browser dialog. Provide promptText for prompts.',
  inputSchema: {
    type: 'object',
    properties: {
      promptText: {
        type: 'string',
        description: 'Text for prompt dialogs',
      },
      workspaceId: WORKSPACE_ID_SCHEMA,
    },
  },
};

export const dismissDialogTool = {
  name: 'dismiss_dialog',
  description: 'Dismiss browser dialog.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceId: WORKSPACE_ID_SCHEMA,
    },
  },
};

// Tool definitions - History
export const navigateHistoryTool = {
  name: 'navigate_history',
  description: 'Navigate history back/forward. UIDs become stale.',
  inputSchema: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['back', 'forward'],
        description: 'back or forward',
      },
      workspaceId: WORKSPACE_ID_SCHEMA,
    },
    required: ['direction'],
  },
};

// Tool definitions - Viewport
export const setViewportSizeTool = {
  name: 'set_viewport_size',
  description: 'Set viewport dimensions in pixels.',
  inputSchema: {
    type: 'object',
    properties: {
      width: {
        type: 'number',
        description: 'Width in pixels',
      },
      height: {
        type: 'number',
        description: 'Height in pixels',
      },
      workspaceId: WORKSPACE_ID_SCHEMA,
    },
    required: ['width', 'height'],
  },
};

// Handlers - Dialogs
export async function handleAcceptDialog(args: unknown): Promise<McpToolResponse> {
  try {
    const { promptText, workspaceId } =
      (args as { promptText?: string; workspaceId?: string }) || {};

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    try {
      await firefox.acceptDialog(promptText, workspaceId);
      return successResponse(promptText ? `✅ Accepted: "${promptText}"` : '✅ Accepted');
    } catch (error) {
      const errorMsg = (error as Error).message;

      // Concise error for no active dialog
      if (errorMsg.includes('no such alert') || errorMsg.includes('No dialog')) {
        throw new Error('No active dialog');
      }

      throw error;
    }
  } catch (error) {
    return errorResponse(error as Error);
  }
}

export async function handleDismissDialog(_args: unknown): Promise<McpToolResponse> {
  try {
    const { workspaceId } = (_args as { workspaceId?: string }) || {};
    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    try {
      await firefox.dismissDialog(workspaceId);
      return successResponse('✅ Dismissed');
    } catch (error) {
      const errorMsg = (error as Error).message;

      // Concise error for no active dialog
      if (errorMsg.includes('no such alert') || errorMsg.includes('No dialog')) {
        throw new Error('No active dialog');
      }

      throw error;
    }
  } catch (error) {
    return errorResponse(error as Error);
  }
}

// Handlers - History
export async function handleNavigateHistory(args: unknown): Promise<McpToolResponse> {
  try {
    const { direction, workspaceId } = args as {
      direction: 'back' | 'forward';
      workspaceId?: string;
    };

    if (!direction || (direction !== 'back' && direction !== 'forward')) {
      throw new Error('direction parameter is required and must be "back" or "forward"');
    }

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    if (direction === 'back') {
      await firefox.navigateBack(workspaceId);
    } else {
      await firefox.navigateForward(workspaceId);
    }

    return successResponse(`✅ ${direction}`);
  } catch (error) {
    return errorResponse(error as Error);
  }
}

// Handlers - Viewport
export async function handleSetViewportSize(args: unknown): Promise<McpToolResponse> {
  try {
    const { width, height, workspaceId } = args as {
      width: number;
      height: number;
      workspaceId?: string;
    };

    if (typeof width !== 'number' || width <= 0) {
      throw new Error('width parameter is required and must be a positive number');
    }

    if (typeof height !== 'number' || height <= 0) {
      throw new Error('height parameter is required and must be a positive number');
    }

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    await firefox.setViewportSize(width, height, workspaceId);

    return successResponse(`✅ ${width}x${height}`);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
