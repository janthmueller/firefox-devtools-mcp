# Workspace Ownership First Slice

## Summary

`#28` builds on `#26` by adding ownership and approval semantics on top of the new workspace-scoped state model.

The goal is not full browser isolation yet. The goal is to define a correct control model for:

- `shared` tabs/pages by default
- `human-owned` protected areas
- `agent-owned` work areas
- human override and takeover
- agent-vs-agent boundaries

## Why This Needs a Design Pass First

The current implementation from `#26` separates browsing state by `workspaceId`, but it does **not** yet have a separate notion of:

- who is making a request
- which workspace that caller belongs to
- whether a call is acting in its own workspace or crossing into another workspace

Today, many tools simply accept an optional `workspaceId`.

That means the system can distinguish:

- "act in workspace `human`"
- "act in workspace `agent-a`"

but it cannot yet distinguish:

- "the human is acting in workspace `human`"
- "agent B is trying to act in workspace `human`"

Those are not the same thing, and approval semantics depend on the difference.

## First Principle

`workspaceId` and caller identity must not be treated as the same concept.

We need both:

- **caller identity**
  - who is making the request
  - examples: `human`, `agent-a`, `agent-b`
- **target workspace**
  - which workspace the tool should act in
  - examples: `human`, `agent-a`, `shared-research`

Without that distinction, deny-by-default access rules for the human workspace are not enforceable in a trustworthy way.

## Ownership Model

Tabs/pages should support three ownership modes:

- `shared`
- `human-owned`
- `agent-owned`

### Intended semantics

#### `shared`

This should be the default mode.

Meaning:

- human can use it
- agent A can use it
- agent B can use it
- conflicts still need coordination, but access is not restricted by default

#### `human-owned`

Meaning:

- human can use it freely
- agents require explicit approval or handoff

This is the protected mode for the human's active work area.

#### `agent-owned`

Meaning:

- the owning agent can use it normally
- the human can always inspect, enter, and take over
- other agents are denied by default unless the tab is explicitly shared

This is the main agent-vs-agent boundary.

## Tab Identity Requirement

Tab indices are not sufficient for ownership.

Why:

- indices change when tabs open or close
- indices can shift when the human changes tab order
- ownership needs a stable identity that survives reordering

So ownership should attach to a Firewatch-side stable tab record, not to a mutable tab index.

Suggested internal model:

```ts
type WorkspaceId = string;
type TabOwnership = 'shared' | 'human-owned' | 'agent-owned';

interface TabState {
  tabId: string;
  contextId: string;
  ownership: TabOwnership;
  ownerWorkspaceId: WorkspaceId | null;
}
```

Notes:

- `tabId` is a Firewatch-stable identifier
- `contextId` is the live Firefox/driver identity
- `ownerWorkspaceId` is `null` for `shared` tabs

## Required Coordinator Layer

Mutating actions should eventually go through a single decision point.

Examples:

- `select_page`
- `navigate_page`
- `new_page`
- `close_page`
- click/fill/drag actions

The coordinator should answer:

- who is calling?
- which workspace is targeted?
- which tab is affected?
- what is the ownership mode?
- is this allowed?
- does this require approval or handoff?

This does **not** require a giant global queue for all actions, but it does require a central policy check for conflicting or cross-workspace mutations.

## Recommended First Slice for `#28`

Keep the first slice narrow.

### In scope

- define explicit ownership semantics in docs and internal types
- introduce a stable Firewatch-side tab identity concept
- track ownership state alongside tab metadata
- make `shared` the default
- define the rule that `agent-owned` excludes other agents by default but never the human
- define the rule that `human-owned` denies agent access by default

### Not yet in scope

- full approval UI
- dedicated windows
- profile isolation
- complete background execution
- final queue/locking implementation

## Open Constraint

Real approval enforcement requires a caller identity model in addition to `workspaceId`.

That is the key architectural constraint discovered at the start of `#28`.

So the likely sequence is:

1. define ownership + stable tab identity
2. define caller identity vs target workspace semantics
3. then enforce human/agent approval rules in tool behavior

## Relationship to Other Work

- `#24` defined the workspace-isolation architecture direction
- `#26` implemented workspace-scoped selected page/context and snapshot state
- `#28` should add ownership/control semantics on top of that base
- `#22` remains a separate follow-up about resilient target re-identification, not the immediate next layer in the workspace architecture
