# CI and Release

This project ships with GitHub Actions for CI, PR validation, and automated releases.

Workflows

- CI (.github/workflows/ci.yml)

  - Triggers on push to `main` and `develop`.
  - Matrix: Node 20 and 22.
  - Steps: install → lint → format check → typecheck → test → build.
  - Optional: uploads coverage to Codecov if `coverage/lcov.info` exists and `CODECOV_TOKEN` is set.
  - Uploads the `dist/` artifact (Node 20 job) for quick download.

- PR Check (.github/workflows/pr-check.yml)

  - Fast checks on PR open/update: lint, format check, typecheck, unit tests, build.

- Release (.github/workflows/publish.yml)
  - On push to `main` (and via manual dispatch): runs checks, then executes `semantic-release`.
  - `semantic-release` analyzes conventional commits, updates `CHANGELOG.md`, creates the next version tag, publishes `firewatch-mcp` to npm with provenance, and creates a GitHub Release with the npm tarball attached.

Secrets

- `CODECOV_TOKEN` (optional): used by Codecov upload step (CI). The step is skipped if the token or coverage file is missing.

Release flow

1. Merge conventional commits to `main`.
2. The `publish` workflow runs `semantic-release` after checks pass.
3. `semantic-release` determines the next semantic version from commit messages:
   - `fix:` -> patch
   - `feat:` -> minor
   - `!` or `BREAKING CHANGE:` -> major
4. If a release is needed, `semantic-release` updates `CHANGELOG.md`, creates the release commit and git tag, publishes `firewatch-mcp` to npm via trusted publishing, and creates the GitHub Release.
5. For npm publishing to work, the `firewatch-mcp` package on npm must trust the GitHub Actions workflow `publish.yml` for the `janthmueller/firewatch-mcp` repository.

Conventional commit examples

- `fix: handle stale uid lookup during extraction`
- `feat: add compact snapshot output`
- `feat!: rename plugin commands to firewatch`
- `docs: clarify npm trusted publishing setup`

Windows Integration Tests

- On Windows, vitest has known issues with process forking when running integration tests that spawn Firefox.
- See upstream: https://github.com/mozilla/firefox-devtools-mcp/issues/33
- To work around this, we use a separate test runner (`scripts/run-integration-tests-windows.mjs`) that runs integration tests directly via Node.js without vitest's process isolation.
- The CI workflow detects Windows and automatically uses this runner instead of vitest for integration tests.
- Unit tests still run via vitest on all platforms.

Notes

- If you want Codecov upload to run, switch CI test step to `npm run test:coverage` or generate `coverage/lcov.info`.
- Provenance is enabled for npm publish via trusted publishing on GitHub-hosted runners.
- Conventional commit messages on `main` now drive versioning and release notes.
- `CHANGELOG.md` is maintained automatically by semantic-release and committed back to `main` during releases.
- Use `@latest` in README examples to encourage npx usage.
