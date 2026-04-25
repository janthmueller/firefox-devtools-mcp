/**
 * Firefox Client - Public facade for modular Firefox automation
 */

import type { FirefoxLaunchOptions, ConsoleMessage, ExtractTextOptions } from './types.js';
import { WebElement } from 'selenium-webdriver';
import { FirefoxCore } from './core.js';
import { logDebug } from '../utils/logger.js';
import { ConsoleEvents, NetworkEvents } from './events/index.js';
import { DomInteractions } from './dom.js';
import { PageManagement } from './pages.js';
import { SnapshotManager, type Snapshot, type SnapshotOptions } from './snapshot/index.js';

const DEFAULT_WORKSPACE_ID = 'human';
const DEFAULT_CALLER_ID = 'human';

type TabOwnership = 'shared' | 'human-owned' | 'agent-owned';

interface WorkspaceState {
  selectedTabIndex: number;
  currentContextId: string | null;
  snapshot: SnapshotManager;
}

interface TabState {
  tabId: string;
  contextId: string;
  ownership: TabOwnership;
  ownerWorkspaceId: string | null;
}

interface BrowserTab {
  actor: string;
  title: string;
  url: string;
  tabId: string;
  ownership: TabOwnership;
  ownerWorkspaceId: string | null;
}

/**
 * Main Firefox Client facade
 * Delegates to modular components for clean separation of concerns
 */
export class FirefoxClient {
  private core: FirefoxCore;
  private consoleEvents: ConsoleEvents | null = null;
  private networkEvents: NetworkEvents | null = null;
  private pages: PageManagement | null = null;
  private workspaces = new Map<string, WorkspaceState>();
  private tabs = new Map<string, TabState>();
  private nextTabIdCounter = 1;

  constructor(options: FirefoxLaunchOptions) {
    this.core = new FirefoxCore(options);
  }

  /**
   * Connect and initialize all modules
   */
  async connect(): Promise<void> {
    await this.core.connect();

    const driver = this.core.getDriver();

    // Initialize default human workspace
    this.workspaces.set(DEFAULT_WORKSPACE_ID, {
      selectedTabIndex: 0,
      currentContextId: null,
      snapshot: new SnapshotManager(driver),
    });

    // Create centralized navigation handler for lifecycle hooks
    const onNavigate = () => {
      for (const workspace of this.workspaces.values()) {
        workspace.snapshot.clear();
      }
    };

    // Initialize event modules with lifecycle hooks.
    // BiDi (console/network events) is available in both launch and connect-existing
    // modes, provided Firefox has its Remote Agent running. If webSocketUrl is absent
    // from the session capabilities (e.g. Firefox started without --remote-debugging-port),
    // the subscribe calls below will fail gracefully and the modules will be disabled.
    const hasBidi = 'getBidi' in driver && typeof driver.getBidi === 'function';

    if (hasBidi) {
      // Cast to any for BiDi-specific APIs that only exist on selenium WebDriver
      this.consoleEvents = new ConsoleEvents(driver as any, {
        onNavigate,
        autoClearOnNavigate: false,
      });

      this.networkEvents = new NetworkEvents(driver as any, {
        onNavigate,
        autoClearOnNavigate: false,
      });
    }

    this.pages = new PageManagement(
      driver,
      () => this.core.getCurrentContextId(),
      (id: string) => this.core.setCurrentContextId(id)
    );

    const currentContextId = this.core.getCurrentContextId();
    const defaultWorkspace = this.getWorkspaceState(DEFAULT_WORKSPACE_ID);
    defaultWorkspace.currentContextId = currentContextId;

    await this.pages.refreshTabs();
    this.syncTabState();
    defaultWorkspace.selectedTabIndex = this.pages.getSelectedTabIdx();

    // Subscribe to console and network events for ALL contexts (not just current).
    // Failures here are non-fatal: Firefox may not have the Remote Agent / BiDi
    // enabled (e.g. launched with --marionette only, no --remote-debugging-port),
    // in which case webSocketUrl is absent from capabilities and getBidi() throws.
    // We degrade gracefully so all non-BiDi tools still work.
    if (this.consoleEvents) {
      try {
        await this.consoleEvents.subscribe(undefined);
      } catch {
        logDebug('Console events unavailable (BiDi not supported by this Firefox session)');
        this.consoleEvents = null;
      }
    }
    if (this.networkEvents) {
      try {
        await this.networkEvents.subscribe(undefined);
      } catch {
        logDebug('Network events unavailable (BiDi not supported by this Firefox session)');
        this.networkEvents = null;
      }
    }
  }

  // ============================================================================
  // DOM / Evaluate
  // ============================================================================

  async evaluate(script: string): Promise<unknown> {
    const dom = await this.getDom();
    return await dom.evaluate(script);
  }

  async getContent(): Promise<string> {
    const dom = await this.getDom();
    return await dom.getContent();
  }

  async extractText(
    options: ExtractTextOptions = {},
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<string> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.extractText(options);
  }

  async clickBySelector(
    selector: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.clickBySelector(selector);
  }

  async hoverBySelector(
    selector: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.hoverBySelector(selector);
  }

  async fillBySelector(
    selector: string,
    text: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.fillBySelector(selector, text);
  }

  async dragAndDropBySelectors(
    sourceSelector: string,
    targetSelector: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.dragAndDropBySelectors(sourceSelector, targetSelector);
  }

  async uploadFileBySelector(
    selector: string,
    filePath: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.uploadFileBySelector(selector, filePath);
  }

  // UID-based input methods

  async clickByUid(
    uid: string,
    dblClick = false,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.clickByUid(uid, dblClick);
  }

  async hoverByUid(
    uid: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.hoverByUid(uid);
  }

  async fillByUid(
    uid: string,
    value: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.fillByUid(uid, value);
  }

  async dragByUidToUid(
    fromUid: string,
    toUid: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.dragByUidToUid(fromUid, toUid);
  }

  async fillFormByUid(
    elements: Array<{ uid: string; value: string }>,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.fillFormByUid(elements);
  }

  async uploadFileByUid(
    uid: string,
    filePath: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.uploadFileByUid(uid, filePath);
  }

  // ============================================================================
  // Console
  // ============================================================================

  async getConsoleMessages(): Promise<ConsoleMessage[]> {
    if (!this.consoleEvents) {
      throw new Error(
        'Console events not available (Firefox Remote Agent not running — start Firefox with --remote-debugging-port to enable BiDi)'
      );
    }
    return this.consoleEvents.getMessages();
  }

  clearConsoleMessages(): void {
    if (!this.consoleEvents) {
      throw new Error(
        'Console events not available (Firefox Remote Agent not running — start Firefox with --remote-debugging-port to enable BiDi)'
      );
    }
    this.consoleEvents.clearMessages();
  }

  // ============================================================================
  // Pages / Navigation
  // ============================================================================

  async navigate(
    url: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.activateWorkspace(workspaceId, callerId);
    await this.pages.navigate(url);
    this.getWorkspaceState(workspaceId).snapshot.clear();
  }

  async navigateBack(
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.activateWorkspace(workspaceId, callerId);
    return await this.pages.navigateBack();
  }

  async navigateForward(
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.activateWorkspace(workspaceId, callerId);
    return await this.pages.navigateForward();
  }

  async setViewportSize(
    width: number,
    height: number,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.activateWorkspace(workspaceId, callerId);
    return await this.pages.setViewportSize(width, height);
  }

  async acceptDialog(
    promptText?: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.activateWorkspace(workspaceId, callerId);
    return await this.pages.acceptDialog(promptText);
  }

  async dismissDialog(
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.activateWorkspace(workspaceId, callerId);
    return await this.pages.dismissDialog();
  }

  getTabs(): BrowserTab[] {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    return this.pages.getTabs().map((tab) => {
      const tabState = this.tabs.get(tab.actor);
      return {
        ...tab,
        tabId: tabState?.tabId ?? this.buildEphemeralTabId(tab.actor),
        ownership: tabState?.ownership ?? 'shared',
        ownerWorkspaceId: tabState?.ownerWorkspaceId ?? null,
      };
    });
  }

  getSelectedTabIdx(workspaceId = DEFAULT_WORKSPACE_ID): number {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    return this.getWorkspaceState(workspaceId).selectedTabIndex;
  }

  async refreshTabs(): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.pages.refreshTabs();
    this.syncTabState();
    this.reconcileWorkspaceSelections();
  }

  async selectTab(
    index: number,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    this.assertWorkspaceAccess(workspaceId, callerId);
    await this.pages.selectTab(index);
    this.syncTabState();
    this.reconcileWorkspaceSelections();
    const workspace = this.getWorkspaceState(workspaceId);
    workspace.selectedTabIndex = index;
    workspace.currentContextId = this.core.getCurrentContextId();
  }

  async createNewPage(
    url: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<number> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    this.assertWorkspaceAccess(workspaceId, callerId);
    const newIdx = await this.pages.createNewPage(url);
    await this.pages.refreshTabs();
    this.syncTabState();
    this.reconcileWorkspaceSelections();
    const workspace = this.getWorkspaceState(workspaceId);
    workspace.selectedTabIndex = newIdx;
    workspace.currentContextId = this.core.getCurrentContextId();
    this.assignTabOwnership(workspace.currentContextId, workspaceId);
    workspace.snapshot.clear();
    return newIdx;
  }

  async closeTab(
    index: number,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<void> {
    if (!this.pages) {
      throw new Error('Not connected');
    }
    await this.activateWorkspace(workspaceId, callerId);
    await this.pages.closeTab(index);
    await this.pages.refreshTabs();
    this.syncTabState();
    this.reconcileWorkspaceSelections();

    const workspace = this.getWorkspaceState(workspaceId);
    workspace.currentContextId = this.core.getCurrentContextId();
    workspace.snapshot.clear();
  }

  // ============================================================================
  // Network
  // ============================================================================

  async startNetworkMonitoring(): Promise<void> {
    if (!this.networkEvents) {
      throw new Error(
        'Network events not available (Firefox Remote Agent not running — start Firefox with --remote-debugging-port to enable BiDi)'
      );
    }
    this.networkEvents.startMonitoring();
  }

  async stopNetworkMonitoring(): Promise<void> {
    if (!this.networkEvents) {
      throw new Error(
        'Network events not available (Firefox Remote Agent not running — start Firefox with --remote-debugging-port to enable BiDi)'
      );
    }
    this.networkEvents.stopMonitoring();
  }

  async getNetworkRequests(): Promise<any[]> {
    if (!this.networkEvents) {
      throw new Error(
        'Network events not available (Firefox Remote Agent not running — start Firefox with --remote-debugging-port to enable BiDi)'
      );
    }
    return this.networkEvents.getRequests();
  }

  clearNetworkRequests(): void {
    if (!this.networkEvents) {
      throw new Error(
        'Network events not available (Firefox Remote Agent not running — start Firefox with --remote-debugging-port to enable BiDi)'
      );
    }
    this.networkEvents.clearRequests();
  }

  // ============================================================================
  // Snapshot
  // ============================================================================

  async takeSnapshot(
    options?: SnapshotOptions,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<Snapshot> {
    const workspace = this.getWorkspaceState(workspaceId);
    await this.activateWorkspace(workspaceId, callerId);
    return await workspace.snapshot.takeSnapshot(options);
  }

  resolveUidToSelector(uid: string, workspaceId = DEFAULT_WORKSPACE_ID): string {
    return this.getWorkspaceState(workspaceId).snapshot.resolveUidToSelector(uid);
  }

  async resolveUidToElement(
    uid: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<WebElement> {
    await this.activateWorkspace(workspaceId, callerId);
    return await this.getWorkspaceState(workspaceId).snapshot.resolveUidToElement(uid);
  }

  clearSnapshot(workspaceId = DEFAULT_WORKSPACE_ID): void {
    this.getWorkspaceState(workspaceId).snapshot.clear();
  }

  // ============================================================================
  // Screenshot
  // ============================================================================

  async takeScreenshotPage(
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<string> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.takeScreenshotPage();
  }

  async takeScreenshotByUid(
    uid: string,
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<string> {
    const dom = await this.getDom(workspaceId, callerId);
    return await dom.takeScreenshotByUid(uid);
  }

  // ============================================================================
  // Internal / Advanced
  // ============================================================================

  /**
   * Send raw BiDi command (for advanced operations)
   * @internal
   */
  async sendBiDiCommand(method: string, params: Record<string, any> = {}): Promise<any> {
    return await this.core.sendBiDiCommand(method, params);
  }

  /**
   * Get WebDriver instance (for advanced operations)
   * @internal
   */
  getDriver(): any {
    return this.core.getDriver();
  }

  /**
   * Get current browsing context ID (for advanced operations)
   * @internal
   */
  getCurrentContextId(workspaceId = DEFAULT_WORKSPACE_ID): string | null {
    return this.getWorkspaceState(workspaceId).currentContextId;
  }

  /**
   * Update current browsing context ID
   * @internal
   */
  setCurrentContextId(contextId: string, workspaceId = DEFAULT_WORKSPACE_ID): void {
    const workspace = this.getWorkspaceState(workspaceId);
    workspace.currentContextId = contextId;
    if (workspaceId === DEFAULT_WORKSPACE_ID) {
      this.core.setCurrentContextId(contextId);
    }
  }

  /**
   * Check if Firefox is still connected and responsive
   * Returns false if Firefox was closed or connection is broken
   */
  async isConnected(): Promise<boolean> {
    return await this.core.isConnected();
  }

  /**
   * Get log file path (if logging is enabled)
   */
  getLogFilePath(): string | undefined {
    return this.core.getLogFilePath();
  }

  /**
   * Get current launch options
   */
  getOptions(): FirefoxLaunchOptions {
    return this.core.getOptions();
  }

  /**
   * Reset all internal state (used when Firefox is detected as closed)
   */
  reset(): void {
    this.core.reset();
    this.consoleEvents = null;
    this.networkEvents = null;
    this.pages = null;
    this.workspaces.clear();
    this.tabs.clear();
    this.nextTabIdCounter = 1;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async close(): Promise<void> {
    await this.core.close();
  }

  private getWorkspaceState(workspaceId = DEFAULT_WORKSPACE_ID): WorkspaceState {
    const existing = this.workspaces.get(workspaceId);
    if (existing) {
      return existing;
    }

    const driver = this.core.getDriver();
    const workspace: WorkspaceState = {
      selectedTabIndex: this.workspaces.get(DEFAULT_WORKSPACE_ID)?.selectedTabIndex ?? 0,
      currentContextId: this.workspaces.get(DEFAULT_WORKSPACE_ID)?.currentContextId ?? null,
      snapshot: new SnapshotManager(driver),
    };
    this.workspaces.set(workspaceId, workspace);
    return workspace;
  }

  private async activateWorkspace(
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<WorkspaceState> {
    if (!this.pages) {
      throw new Error('Not connected');
    }

    this.assertWorkspaceAccess(workspaceId, callerId);
    const workspace = this.getWorkspaceState(workspaceId);
    await this.pages.refreshTabs();
    this.syncTabState();
    this.reconcileWorkspaceSelections();
    const tabs = this.pages.getTabs();

    if (tabs.length === 0) {
      workspace.selectedTabIndex = 0;
      workspace.currentContextId = null;
      return workspace;
    }

    const existingTabIndex = workspace.currentContextId
      ? tabs.findIndex((tab) => tab.actor === workspace.currentContextId)
      : -1;

    if (existingTabIndex >= 0) {
      workspace.selectedTabIndex = existingTabIndex;
    } else {
      const clampedIndex = Math.min(Math.max(workspace.selectedTabIndex, 0), tabs.length - 1);
      workspace.selectedTabIndex = clampedIndex;
      workspace.currentContextId = tabs[clampedIndex]?.actor ?? null;
    }

    const currentContextId = this.core.getCurrentContextId();
    const targetContextId = tabs[workspace.selectedTabIndex]?.actor ?? null;
    if (targetContextId && currentContextId !== targetContextId) {
      await this.pages.selectTab(workspace.selectedTabIndex);
    }

    workspace.currentContextId = this.core.getCurrentContextId();
    return workspace;
  }

  private async getDom(
    workspaceId = DEFAULT_WORKSPACE_ID,
    callerId = DEFAULT_CALLER_ID
  ): Promise<DomInteractions> {
    await this.activateWorkspace(workspaceId, callerId);
    return new DomInteractions(this.core.getDriver(), (uid: string) =>
      this.getWorkspaceState(workspaceId).snapshot.resolveUidToElement(uid)
    );
  }

  private syncTabState(): void {
    if (!this.pages) {
      return;
    }

    const currentTabs = this.pages.getTabs();
    const currentContextIds = new Set(currentTabs.map((tab) => tab.actor));

    for (const tab of currentTabs) {
      if (this.tabs.has(tab.actor)) {
        continue;
      }

      this.tabs.set(tab.actor, {
        tabId: `tab-${this.nextTabIdCounter++}`,
        contextId: tab.actor,
        ownership: 'shared',
        ownerWorkspaceId: null,
      });
    }

    for (const contextId of Array.from(this.tabs.keys())) {
      if (!currentContextIds.has(contextId)) {
        this.tabs.delete(contextId);
      }
    }
  }

  private assignTabOwnership(contextId: string | null, workspaceId: string): void {
    if (!contextId) {
      return;
    }

    const tabState = this.tabs.get(contextId);
    if (!tabState) {
      return;
    }

    if (workspaceId === DEFAULT_WORKSPACE_ID) {
      tabState.ownership = 'shared';
      tabState.ownerWorkspaceId = null;
      return;
    }

    tabState.ownership = 'agent-owned';
    tabState.ownerWorkspaceId = workspaceId;
  }

  private buildEphemeralTabId(contextId: string): string {
    return `tab-unknown-${contextId}`;
  }

  private assertWorkspaceAccess(workspaceId: string, callerId: string): void {
    if (callerId === DEFAULT_CALLER_ID) {
      return;
    }

    if (workspaceId === DEFAULT_WORKSPACE_ID) {
      throw new Error(
        `Caller "${callerId}" is not allowed to act in the human workspace without explicit approval`
      );
    }

    if (workspaceId !== callerId) {
      throw new Error(
        `Caller "${callerId}" is not allowed to act in workspace "${workspaceId}" by default`
      );
    }
  }

  private reconcileWorkspaceSelections(): void {
    if (!this.pages) {
      return;
    }

    const tabs = this.pages.getTabs();

    for (const workspace of this.workspaces.values()) {
      if (tabs.length === 0) {
        workspace.selectedTabIndex = 0;
        workspace.currentContextId = null;
        continue;
      }

      const existingTabIndex = workspace.currentContextId
        ? tabs.findIndex((tab) => tab.actor === workspace.currentContextId)
        : -1;

      if (existingTabIndex >= 0) {
        workspace.selectedTabIndex = existingTabIndex;
        continue;
      }

      const clampedIndex = Math.min(Math.max(workspace.selectedTabIndex, 0), tabs.length - 1);
      workspace.selectedTabIndex = clampedIndex;
      workspace.currentContextId = tabs[clampedIndex]?.actor ?? null;
    }
  }
}

// Re-export types
export type { Snapshot } from './snapshot/index.js';

// Re-export for backward compatibility
export { FirefoxClient as FirefoxDevTools };
