# Workspace Isolation Proposal

## Summary

Firewatch currently assumes a single active operator per MCP server process. That assumption leaks through:

- one global selected tab/context
- one global snapshot cache
- one global UID namespace
- one visible browser window that both the human and the agent can disturb

This document proposes a workspace model that moves Firewatch toward human + agent coexistence without requiring a full rebuild first.

## Problem

The current architecture is single-tenant in both server state and browser behavior.

### Global state today

These state surfaces are global per `FirefoxClient` instance:

- selected page index in [src/firefox/pages.ts](../src/firefox/pages.ts)
- current browsing context id in [src/firefox/core.ts](../src/firefox/core.ts)
- snapshot resolver cache and snapshot id in [src/firefox/snapshot/manager.ts](../src/firefox/snapshot/manager.ts)

That means:

- one client can change the active tab for another
- one client can invalidate another client’s snapshot UIDs
- human browsing and agent browsing interfere visibly in the same Firefox window

### Two interference layers

There are two distinct problems:

1. Server-state collision
- page selection, context selection, and snapshot state are shared across callers

2. Browser-UI collision
- tab switching, scrolling, clicks, and typing happen in the same visible browser session the human is using

The second problem is the one users actually feel most sharply.

## Goals

The target experience is:

- a human can keep browsing normally
- one or more agents can work in parallel
- useful authenticated browser state should stay shared
- agents do not silently steal the human’s active tab
- workspace-local actions do not invalidate unrelated workspace state

The intended model is:

- one shared browser identity/session
- multiple logical workspaces on top of it
- explicit ownership, approval, and handoff rules instead of hard browser-profile separation

## Non-Goals

This proposal does not try to solve all isolation problems at once.

It does not require:

- full browser profile isolation as the primary design
- hidden/background browsing contexts in the first iteration
- a total rewrite away from Selenium/WebDriver

## Current Architecture Constraints

### Current state model

`FirefoxClient` owns one `PageManagement` and one `SnapshotManager` for the whole MCP server process.

Consequences:

- `select_page` changes the globally active tab
- `take_snapshot()` without `uid` resets the global snapshot namespace
- navigation clears the global snapshot cache

This is a coherent single-user model, but it is the wrong model for human + agent coexistence.

### Why targeting improvements alone are not enough

Locator-like actions and late resolution are still desirable, but they do not solve:

- who owns the active tab
- whose snapshot cache is valid
- which client is allowed to interrupt the visible human browsing flow

So workspace isolation should come before deeper interaction-layer redesign.

## Proposed Model

Introduce a workspace abstraction above the current global browser state.

### Workspace

A workspace is a logical browsing state container for one MCP client or task.

Each workspace should eventually own:

- selected page/tab
- selected browsing context id
- snapshot cache
- UID namespace
- transient task-local state

### Ownership model

Pages/tabs should have explicit ownership semantics:

- `human-owned`
- `agent-owned`
- `shared`

Expected rules:

- agents should not silently take over a `human-owned` tab
- `shared` tabs should require explicit conflict rules
- the system should make handoff visible instead of implicit

### Workspace access model

Workspace access should be asymmetric.

The human is the supervisor and should always be able to inspect, enter, and take over an agent workspace.

Agents should not automatically receive the same privilege in reverse.

Recommended baseline:

- human workspace
  - human: full access
  - agents: denied by default unless explicitly approved
- agent workspace
  - owning agent: normal access
  - human: full access and takeover rights
  - other agents: denied by default unless explicitly shared

This keeps delegation safe while preserving human visibility and override.

### Isolation levels

There are multiple levels of possible isolation.

#### Level 1: Logical workspace isolation

Scope:

- workspace-scoped selected tab/context
- workspace-scoped snapshot state
- workspace-scoped UID namespace

Pros:

- smallest architectural change
- directly addresses server-state collision

Cons:

- browser UI interference still exists if workspaces share one visible window

#### Level 2: Dedicated tabs or tab groups

Scope:

- each workspace is pinned to dedicated tabs
- ownership and approval rules prevent cross-workspace stealing

Pros:

- clearer mental model
- reduces accidental tab hijacking

Cons:

- visible switching may still bother the human if Firefox must activate a tab to act

#### Level 3: Dedicated windows per workspace

Scope:

- human and agent work in separate browser windows
- browser session may still be shared where technically feasible

Pros:

- strongest practical UX improvement without full profile split

Cons:

- more window-management complexity

#### Level 4: Separate browser profile/session per agent

Scope:

- strongest isolation
- cleanest ownership boundary

Pros:

- almost no human/agent UI collision

Cons:

- breaks the shared-session model users actually want
- complicates login/session management
- heavier operational model

Recommendation:

- do not treat this as the target architecture
- keep it only as an explicit fallback for cases where hard isolation matters more than shared logged-in browser state

## Recommended First Slice

The first implementation slice should be intentionally narrow:

1. workspace-scoped selected page/context
2. workspace-scoped snapshot cache and UID namespace
3. no tab locks yet
4. no dedicated windows yet
5. no profile/session split

Why this slice:

- highest value for lowest surface area
- removes the most obvious server-state collisions first
- gives a concrete base for later ownership and window isolation

## Proposed API Direction

### Explicit `workspaceId`

Meaning:

- tools become workspace-aware through explicit workspace selection or arguments

Pros:

- more controllable
- easier to reason about in logs and debugging

Cons:

- more API surface
- more burden on clients

### Recommended direction

Treat workspaces as first-class product objects, not just transport-derived state.

That means:

- workspaces should be explicitly representable and inspectable
- an agent can have its own workspace
- an agent can be approved to act in the human workspace when desired
- the human should always be able to inspect and enter an agent workspace

Connection identity can still be useful internally, but it should not be the full workspace model.

## Shared Session Principle

The preferred architecture is not “one browser profile per agent.”

The preferred architecture is:

- shared cookies/logins/session state
- workspace-scoped control state
- clearer ownership, approval, and handoff semantics

Why:

- separate profiles undermine one of Firewatch’s main advantages: operating in the same live authenticated browser environment the human is already using
- separate profiles make login/session management much heavier
- they reduce coexistence problems by giving up the shared-browser value proposition rather than solving it cleanly

So the system should optimize first for:

- one shared browser identity
- many logical workspaces

and only keep separate profiles as a fallback escape hatch.

## Visibility Principle

Agent workspaces should not become hidden black boxes.

The human should always be able to:

- inspect an agent workspace
- enter that workspace
- understand which pages/tabs it currently owns
- take over when needed

This is important both for trust and for practical debugging.

## Implementation Sketch

### New internal abstraction

Introduce a `WorkspaceState` model:

```ts
interface WorkspaceState {
  selectedTabIndex: number | null;
  currentContextId: string | null;
  snapshot: SnapshotState;
}
```

Where `SnapshotState` contains:

- current snapshot id
- UID resolver mappings
- next UID counter context

### Refactor targets

Likely refactor points:

- move selected-tab state out of `PageManagement` globals and into workspace state
- move current-context selection out of a single global `FirefoxCore.currentContextId`
- split `SnapshotManager` so snapshot storage is workspace-scoped instead of singleton-scoped

### Tool semantics that need to change first

The following tools are immediately affected:

- `list_pages`
- `select_page`
- `new_page`
- `close_page`
- `take_snapshot`
- `clear_snapshot`
- all UID-based action tools

The first behavioral requirement is:

- one workspace must not invalidate another workspace’s snapshot state by default

## Open Questions

- Does Selenium/WebDriver require visible activation of a tab for all interactions we care about?
- Can dedicated windows reduce enough human/agent interference without requiring profile splits?
- Should page ownership live in the server only, or also surface through MCP tools?
- What should happen when two workspaces want the same tab?
- How should a human explicitly reclaim or hand off a tab?

## Why This Is the Right Direction

The strongest long-term improvement is not “make UIDs more stable.”

It is:

- isolate browsing state by workspace
- add ownership and handoff semantics
- then improve targeting/actions inside that safer model

That sequence gets Firewatch closer to a real shared human + agent browser instead of a single automation driver with better helpers.
