# Project Tracker

## Current Focus

- `#28` `feat: add workspace tab ownership and human approval semantics`
  - Status: `in-progress`
  - Current phase: define the first ownership/approval slice on top of workspace-scoped state
  - Output target: shared-by-default tab ownership model plus deny-by-default agent access to protected human space

## Recent Completed Work

- `#26` introduced workspace-scoped selected page/context and workspace-scoped snapshot state
- `#24` added the workspace isolation proposal and architecture baseline
- `#21` improved snapshot failure diagnostics so `take_snapshot` preserves real injected errors instead of collapsing to `Unknown error`

## Next Likely Steps

1. Define stable Firewatch-side tab identity so ownership does not depend on mutable tab indices
2. Enforce human-vs-agent and agent-vs-agent access rules on top of workspace state
3. Extend the ownership model into the tool surfaces that can currently act without approval context
