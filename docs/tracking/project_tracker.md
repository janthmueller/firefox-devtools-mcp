# Project Tracker

## Current Focus

- `#26` `feat: introduce workspace-scoped selected page and snapshot state`
  - Status: `in-progress`
  - Current phase: first implementation slice
  - Output target: workspace-scoped selected page/context plus workspace-scoped snapshot state

## Recent Completed Work

- `#24` added the workspace isolation proposal and architecture baseline
- `#21` improved snapshot failure diagnostics so `take_snapshot` preserves real injected errors instead of collapsing to `Unknown error`

## Next Likely Steps

1. Finish the workspace-state split and land the first implementation slice
2. Validate which additional tools need explicit workspace-awareness next
3. Split follow-up issues for ownership, locking, and human approval semantics
