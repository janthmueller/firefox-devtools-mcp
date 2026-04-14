# Project Rules

## Overview
- Use this repository as the source of truth for planning, implementation, and tracking.
- Keep architecture and product specifics in `docs/`, not hardcoded in this file.

## Coding

### Types
- Use explicit type hints for all functions, variables, and fields.
- No `isinstance`/runtime type checks as control flow.
- No fallback casting; if a type is unknown, fix the design.

### Interfaces
- Define clear input/output types for every function and module boundary.
- Avoid passing config dicts into functions; prefer typed models/params.
- Keep interfaces stable and documented; changes must be explicit.

### Conventions
- Prefer clear, consistent naming; avoid vague abbreviations.
- Prefer Pydantic models or dataclasses over loose dicts.
- Keep functions/modules single-responsibility and focused.
- Choose an appropriate abstraction level; avoid trivial micro-functions that obscure flow.
- Avoid tiny one- or two-line helpers; extract only when it improves clarity or reuse.

### Errors and Fallbacks
- Raise on missing required data or invalid state.
- Avoid fallbacks whenever possible; prefer hard failures.
- If a fallback is necessary, always log a warning with enough context to find and fix it later.

## Workflow

### Branching
- Work must track an issue. If we decide to work on something, it needs an issue. Small non-code housekeeping may skip an issue if approved.
- Always work on a dedicated branch (never on `main`).
- When merged, close the linked issue.

### Execution Lifecycle (Required)
1. Pick one issue as the active task.
2. Set status to `status:in-progress` when implementation starts.
3. Open PR with `Closes #<issue_number>` when work is complete.
4. Merge only after merge-gate checks pass.
5. After merge: confirm issue is closed, pull `main`, and start the next issue.

### Status Policy (Required)
- `status:backlog`
  - Problem and scope are defined.
  - Required labels are present.
  - No active implementation branch required.
- `status:planned`
  - Acceptance criteria are explicit.
  - Implementation approach is clear.
  - Ready to start implementation.
- `status:in-progress`
  - Active branch exists and work is ongoing.
  - Tests are required for changed behavior (new or updated tests).
  - Run relevant checks locally during implementation (`pnpm run check`, `pnpm run test`).
- `status:done`
  - PR is merged to `main`.
  - Required CI checks are green.
  - Relevant tests passed for changed scope.
  - Docs/tracker updated if behavior/process changed.
  - Local repo synced to latest `main`.
  - Coverage target met for touched logic (see coverage rule below).

### Coverage Rule (Required)
- Target: at least `80%` coverage for touched modules and critical branches.
- Priority focus: core decision logic, data transforms, and failure paths.
- If automated coverage is not yet wired in CI:
  - include explicit tests for all important branches in changed code, and
  - open/follow an issue to enforce numeric coverage in CI before broad scaling.

### Merge Gate (Required Before Merge)
- Relevant tests must run and pass for changed scope.
- CI checks for the PR must be green.
- Docs and tracker updates must be included when behavior/architecture/process changed.
- No unresolved high-severity review findings.
- If tests are missing, create/follow an issue to add them before scaling the same area.

### Owner Override
- Project owner (Jan) can override or bypass any of these rules at their discretion. A direct instruction from the owner in chat is sufficient to proceed.

### Issues
- Before creating any new issue, ask the user for approval.
- For any new task/feature/bug, create a GitHub issue first (after approval).
- Label every new issue using the schema below.
  - Prefixes: `type:*`, `priority:*`, `status:*`, `area:*`.
  - Required: exactly one `type:*`, one `priority:*`, one `status:*`, and one or more `area:*`.
  - Optional: `tech-debt` when it fits.
  - `type:*` examples: `type:feature`, `type:bug`, `type:refactor`, `type:security`, `type:proposal`.
  - `area:*` examples: `area:frontend`, `area:backend`, `area:infra`, `area:data`, `area:architecture`, `area:project`.
  - `priority:*` allowed values: `priority:must`, `priority:should`, `priority:could`, `priority:wont`.
  - `status:*` allowed values:
    - `status:backlog` — accepted but not scheduled
    - `status:planned` — queued/ready to work
    - `status:in-progress` — actively being worked on
    - `status:done` — completed and merged/resolved
- Only close issues with a PR or a clear resolution note.
- On issue creation, always do all of the following:
  - apply required labels (`type:*`, `priority:*`, `status:*`, `area:*`)
  - ensure one valid `status:*` label is present
- Status sync is automated:
  - workflow file: `.github/workflows/sync-issue-status-to-project.yml`
  - automation updates board **Status** from the issue `status:*` label
- Do not do manual board Status updates for normal flow; only do manual correction if automation fails.

### Privacy Policy
- Everything in this project is private by default.
- Keep repository, issues, pull requests, and project boards private.
- Do not create or convert any project artifact to public visibility unless the user explicitly asks.
- Assume all planning docs and implementation details are internal-only.

## Tools

### GitHub MCP
- Default repository: `janthmueller/firefox-devtools-mcp`.
- Use GitHub MCP for issue and PR operations (search, read, comment, status checks).
- Write actions (create/update/close issues, PR comments/reviews, merges) require explicit user approval.
- Do not perform GitHub write actions unless an explicit draft was shown to the user and approved.

### Board Policy (Kanban)
- Project **Status field** is the workflow source of truth.
- Required board status columns:
  - `status:backlog`
  - `status:planned`
  - `status:in-progress`
  - `status:done`
- Keep issue `status:*` labels as a mirror/filtering aid (not the primary workflow driver).
- If board status and issue status label differ, board status wins and labels should be updated to match.

### Context/Docs Verification
- Whenever unsure about a library/API interface, behavior, or response schema, verify against official docs.
- Prefer verified interfaces over assumptions.
- Keep queries specific and confirm exact fields/signatures before implementation.

## Documentation Discipline
- Keep all project docs under `docs/`.
- Update `docs/README.md` when adding/moving docs.
- For every meaningful product/tech decision, add or update docs (do not keep key decisions only in chat).
- Prefer small focused docs by topic (strategy/content/operations/api/tracking).
- Keep file names explicit and stable; avoid frequent renames.
- After major updates, reflect status and next steps in `docs/tracking/project_tracker.md`.
- Keep examples, schemas, and contracts versioned in `docs/` before implementation.
