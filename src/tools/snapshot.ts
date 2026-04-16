/**
 * Snapshot tools for DOM structure capture with UID mapping
 */

import { successResponse, errorResponse, TOKEN_LIMITS } from '../utils/response-helpers.js';
import { handleUidError } from '../utils/uid-helpers.js';
import type { McpToolResponse } from '../types/common.js';

const DEFAULT_SNAPSHOT_LINES = 100;

// Tool definitions
export const takeSnapshotTool = {
  name: 'take_snapshot',
  description:
    'Capture a DOM snapshot with stable UIDs. Omit uid to create a fresh document-root snapshot and replace the current UID map. Provide uid to zoom into a subtree while reusing the current snapshot UID space. Retake after navigation.',
  inputSchema: {
    type: 'object',
    properties: {
      maxLines: {
        type: 'number',
        description: 'Max lines (default: 100)',
      },
      includeAttributes: {
        type: 'boolean',
        description: 'Include ARIA attributes (default: false)',
      },
      includeText: {
        type: 'boolean',
        description: 'Include text (default: true)',
      },
      maxDepth: {
        type: 'number',
        description: 'Max tree depth',
      },
      includeAll: {
        type: 'boolean',
        description:
          'Include all visible elements without relevance filtering. Useful for Vue/Livewire apps (default: false)',
      },
      selector: {
        type: 'string',
        description: 'CSS selector to scope snapshot to specific element (e.g., "#app")',
      },
      uid: {
        type: 'string',
        description:
          'Optional UID to use as the subtree root. Omit to create a fresh document-root snapshot that replaces the current UID map. When provided, maxDepth becomes relative to this root and the current snapshot UID space is reused. After navigation, old UIDs become stale and a fresh root snapshot is required.',
      },
      collectorMaxTextLength: {
        anyOf: [{ type: 'number' }, { type: 'null' }],
        description:
          'Per-node text cap during snapshot collection. Omit to use the default compact preview behavior, set null for uncapped text.',
      },
      formatterMaxTextLength: {
        anyOf: [{ type: 'number' }, { type: 'null' }],
        description:
          'Per-node text cap when formatting snapshot output. Omit to use the default compact preview behavior, set null for uncapped text.',
      },
    },
  },
};

export const resolveUidToSelectorTool = {
  name: 'resolve_uid_to_selector',
  description: 'Resolve UID to CSS selector. Fails if stale.',
  inputSchema: {
    type: 'object',
    properties: {
      uid: {
        type: 'string',
        description: 'UID from snapshot',
      },
    },
    required: ['uid'],
  },
};

export const clearSnapshotTool = {
  name: 'clear_snapshot',
  description: 'Clear snapshot cache. Usually not needed.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

// Handlers
export async function handleTakeSnapshot(args: unknown): Promise<McpToolResponse> {
  try {
    const {
      maxLines: requestedMaxLines = DEFAULT_SNAPSHOT_LINES,
      includeAttributes = false,
      includeText = true,
      maxDepth,
      includeAll = false,
      selector,
      uid,
      collectorMaxTextLength,
      formatterMaxTextLength,
    } = (args as {
      maxLines?: number;
      includeAttributes?: boolean;
      includeText?: boolean;
      maxDepth?: number;
      includeAll?: boolean;
      selector?: string;
      uid?: string;
      collectorMaxTextLength?: number | null;
      formatterMaxTextLength?: number | null;
    }) || {};

    validateTextLengthControl('collectorMaxTextLength', collectorMaxTextLength);
    validateTextLengthControl('formatterMaxTextLength', formatterMaxTextLength);
    if (selector !== undefined && uid !== undefined) {
      throw new Error('selector and uid cannot be used together');
    }

    // Apply hard cap on maxLines to prevent token overflow
    const maxLines = Math.min(Math.max(1, requestedMaxLines), TOKEN_LIMITS.MAX_SNAPSHOT_LINES_CAP);
    const wasCapped = requestedMaxLines > TOKEN_LIMITS.MAX_SNAPSHOT_LINES_CAP;

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    // Pass snapshot options to manager
    const snapshotOptions: any = {};
    if (includeAll) {
      snapshotOptions.includeAll = includeAll;
    }
    if (selector) {
      snapshotOptions.selector = selector;
    }
    if (uid) {
      snapshotOptions.uid = uid;
    }
    if (collectorMaxTextLength !== undefined) {
      snapshotOptions.collectorMaxTextLength = collectorMaxTextLength;
    }
    if (formatterMaxTextLength !== undefined) {
      snapshotOptions.formatterMaxTextLength = formatterMaxTextLength;
    }
    const snapshot = await firefox.takeSnapshot(
      Object.keys(snapshotOptions).length > 0 ? snapshotOptions : undefined
    );

    // Import formatter to apply custom options
    const { formatSnapshotTree } = await import('../firefox/snapshot/formatter.js');
    const options: any = {
      includeAttributes,
      includeText,
    };
    if (maxDepth !== undefined) {
      options.maxDepth = maxDepth;
    }
    if (formatterMaxTextLength !== undefined) {
      options.maxTextLength = formatterMaxTextLength;
    }
    const formattedText = formatSnapshotTree(snapshot.json.root, 0, options);

    // Get snapshot text (truncated if needed)
    const lines = formattedText.split('\n');

    const truncated = lines.length > maxLines;
    const displayLines = truncated ? lines.slice(0, maxLines) : lines;

    // Build compact output
    let output = `📸 Snapshot (id=${snapshot.json.snapshotId})`;
    if (selector) {
      output += ` [selector: ${selector}]`;
    }
    if (uid) {
      output += ` [uid root: ${uid}]`;
    }
    if (includeAll) {
      output += ' [includeAll: true]';
    }
    if (wasCapped) {
      output += ` [maxLines capped: ${TOKEN_LIMITS.MAX_SNAPSHOT_LINES_CAP}]`;
    }
    if (snapshot.json.truncated) {
      output += ' [DOM truncated]';
    }
    output += '\n\n';

    // Add snapshot tree
    output += displayLines.join('\n');

    if (truncated) {
      output += `\n\n[+${lines.length - maxLines} lines, use maxLines to see more]`;
    }

    return successResponse(output);
  } catch (error) {
    return errorResponse(
      new Error(
        `Failed to take snapshot: ${(error as Error).message}\n\n` +
          'The page may not be fully loaded or accessible.'
      )
    );
  }
}

function validateTextLengthControl(
  name: 'collectorMaxTextLength' | 'formatterMaxTextLength',
  value: number | null | undefined
): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number or null`);
  }
}

export async function handleResolveUidToSelector(args: unknown): Promise<McpToolResponse> {
  try {
    const { uid } = args as { uid: string };

    if (!uid || typeof uid !== 'string') {
      throw new Error('uid parameter is required and must be a string');
    }

    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    try {
      const selector = firefox.resolveUidToSelector(uid);
      return successResponse(`${uid} → ${selector}`);
    } catch (error) {
      throw handleUidError(error as Error, uid);
    }
  } catch (error) {
    return errorResponse(error as Error);
  }
}

export async function handleClearSnapshot(_args: unknown): Promise<McpToolResponse> {
  try {
    const { getFirefox } = await import('../index.js');
    const firefox = await getFirefox();

    firefox.clearSnapshot();

    return successResponse('🧹 Snapshot cleared');
  } catch (error) {
    return errorResponse(error as Error);
  }
}
