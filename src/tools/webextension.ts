/**
 * WebExtension tools for MCP
 * Tools for installing and managing Firefox extensions via WebDriver BiDi
 */

import { successResponse, errorResponse } from '../utils/response-helpers.js';
import type { McpToolResponse } from '../types/common.js';

// ============================================================================
// Tool: install_extension
// ============================================================================

export const installExtensionTool = {
  name: 'install_extension',
  description:
    'Install a Firefox extension using WebDriver BiDi webExtension.install command. Supports installing from archive (.xpi/.zip), base64-encoded data, or unpacked directory.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['archivePath', 'base64', 'path'],
        description:
          'Extension data type: "archivePath" for .xpi/.zip, "base64" for encoded data, "path" for unpacked directory',
      },
      path: {
        type: 'string',
        description: 'File path (for archivePath or path types)',
      },
      value: {
        type: 'string',
        description: 'Base64-encoded extension data (for base64 type)',
      },
      permanent: {
        type: 'boolean',
        description:
          'Firefox-specific: Install permanently (requires signed extension). Default: false (temporary install)',
      },
    },
    required: ['type'],
  },
};

export async function handleInstallExtension(args: unknown): Promise<McpToolResponse> {
  try {
    const { type, path, value, permanent } = args as {
      type: 'archivePath' | 'base64' | 'path';
      path?: string;
      value?: string;
      permanent?: boolean;
    };

    if (!type) {
      throw new Error('type parameter is required');
    }

    // Validate required fields based on type
    if ((type === 'archivePath' || type === 'path') && !path) {
      throw new Error(`path parameter is required for type "${type}"`);
    }
    if (type === 'base64' && !value) {
      throw new Error('value parameter is required for type "base64"');
    }

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    // Build extensionData parameter
    const extensionData: Record<string, string> = { type };
    if (path) {
      extensionData.path = path;
    }
    if (value) {
      extensionData.value = value;
    }

    // Build BiDi command parameters
    const params: Record<string, any> = { extensionData };
    if (permanent !== undefined) {
      params['moz:permanent'] = permanent;
    }

    const result = await firefox.sendBiDiCommand('webExtension.install', params);

    const extensionId = result?.extension || result?.id || 'unknown';
    const installType = permanent ? 'permanent' : 'temporary';

    return successResponse(
      `✅ Extension installed (${installType}):\n  ID: ${extensionId}\n  Type: ${type}${path ? `\n  Path: ${path}` : ''}`
    );
  } catch (error) {
    return errorResponse(error as Error);
  }
}

// ============================================================================
// Tool: uninstall_extension
// ============================================================================

export const uninstallExtensionTool = {
  name: 'uninstall_extension',
  description:
    'Uninstall a Firefox extension using WebDriver BiDi webExtension.uninstall command. Requires the extension ID returned by install_extension or obtained from list_extensions.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Extension ID (e.g., "addon@example.com")',
      },
    },
    required: ['id'],
  },
};

export async function handleUninstallExtension(args: unknown): Promise<McpToolResponse> {
  try {
    const { id } = args as { id: string };

    if (!id || typeof id !== 'string') {
      throw new Error('id parameter is required and must be a string');
    }

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    await firefox.sendBiDiCommand('webExtension.uninstall', { extension: id });

    return successResponse(`✅ Extension uninstalled:\n  ID: ${id}`);
  } catch (error) {
    return errorResponse(error as Error);
  }
}
