import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotManager } from '@/firefox/snapshot/manager.js';
import type { InjectedScriptResult } from '@/firefox/snapshot/types.js';

describe('SnapshotManager', () => {
  let manager: SnapshotManager;

  beforeEach(() => {
    manager = new SnapshotManager({} as never);
  });

  it('surfaces preserved injected snapshot errors', async () => {
    vi.spyOn(manager as any, 'executeInjectedScript').mockResolvedValue({
      tree: null,
      uidMap: [],
      truncated: false,
      snapshotError: 'dynamic subtree detached',
    } satisfies InjectedScriptResult);

    await expect(manager.takeSnapshot()).rejects.toThrow(
      'Failed to generate snapshot: dynamic subtree detached'
    );
  });

  it('adds subtree guidance for uid-rooted snapshot errors', async () => {
    (manager as any).resolver.setSnapshotId(7);

    vi.spyOn(manager as any, 'executeInjectedScript').mockResolvedValue({
      tree: null,
      uidMap: [],
      truncated: false,
      snapshotError: 'target node replaced during walk',
    } satisfies InjectedScriptResult);

    await expect(manager.takeSnapshot({ uid: '7_0' })).rejects.toThrow(
      'Failed to generate snapshot: target node replaced during walk The targeted subtree may have changed while the snapshot was being generated; take a fresh root snapshot and retry.'
    );
  });
});
