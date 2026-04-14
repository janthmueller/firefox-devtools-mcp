/**
 * Simple logger for Firewatch MCP server
 */

export function log(message: string, ...args: unknown[]): void {
  console.error(`[firewatch-mcp] ${message}`, ...args);
}

export function logError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.error(`[firewatch-mcp] ERROR: ${message}`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`[firewatch-mcp] ERROR: ${message}`, error);
  }
}

export function logDebug(message: string, ...args: unknown[]): void {
  if (process.env.DEBUG === '*' || process.env.DEBUG?.includes('firewatch')) {
    console.error(`[firewatch-mcp] DEBUG: ${message}`, ...args);
  }
}
