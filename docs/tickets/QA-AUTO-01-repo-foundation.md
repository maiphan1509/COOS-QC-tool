# QA-AUTO-01 — Repository foundation for automation

| Field | Value |
| --- | --- |
| Type | Task |
| Size | S |
| Phase | 0 Foundation |
| Depends on | — |
| Blocks | QA-AUTO-02 and all later tickets |
| Labels | `automation`, `infra` |

## Context

This repository is a skill pack. `AGENTS.md` states it "ships no application code", and the only CI job (`.github/workflows/check.yml`) lints shell scripts and checks skill mirrors. On 2026-10-08 the team decided automation code lives here, under `postman/` and `e2e/`.

Current state:

- `.postman/resources.yaml` and `.postman/workflows.yaml` link the repo to a Postman team workspace through Native Git, but are untracked.
- `postman/` holds only empty folders and `.DS_Store` files.
- The repository is **public** (see the blocker in the [epic README](README.md)).

## Goal

A clean, documented layout and toolchain that every later ticket builds on, without breaking the existing skill-pack CI.

## Scope

### In scope

- Repository visibility decision.
- Folder layout, Node.js and TypeScript toolchain, lint and format.
- `.gitignore` for reports, auth state, and local secrets.
- Documentation updates so `AGENTS.md` and `README.md` match reality.

### Out of scope

- Any test code (QA-AUTO-04, QA-AUTO-07).
- Secrets and environments (QA-AUTO-02).

## Tasks

- [ ] Get an owner decision on repository visibility: make the repository private, or move automation to a private repository. Record the decision in this ticket.
- [ ] Create the layout:

  ```text
  postman/
    collections/        # Native Git collection files
    environments/       # environment files, keys only, no secret values
    specs/COAD/         # COAD.yaml
    globals/
    data/               # CSV/JSON data files for data-driven runs
  e2e/
    playwright.config.ts
    setup/
    pages/{advertiser,publisher,admin}/
    tests/{advertiser,publisher,admin,cross-platform}/
    fixtures/
    data/
    utils/
  docs/
    automation/         # conventions, runbook, decisions (ADRs)
    tickets/
  .github/workflows/
    check.yml           # existing, unchanged
    api-tests.yml       # QA-AUTO-04
    e2e-tests.yml       # QA-AUTO-12
  ```

- [ ] Root `package.json` with scripts `lint`, `format`, `test:api`, `test:e2e`; pin Node.js Active LTS in `.nvmrc` and `engines`.
- [ ] TypeScript config for `e2e/`; ESLint with `eslint-plugin-playwright`; Prettier.
- [ ] Extend `.gitignore`: `node_modules/`, `playwright-report/`, `test-results/`, `blob-report/`, `e2e/.auth/`, `reports/`, `.env`, `.env.*` (keep `.env.example`).
- [ ] Delete tracked or stray `.DS_Store` files under `postman/`.
- [ ] Review `.postman/resources.yaml` and `.postman/workflows.yaml` (IDs only, no secrets), then commit them.
- [ ] Update `AGENTS.md`: rewrite "What this repository is", add an "Automation (`postman/`, `e2e/`)" section pointing to `docs/automation/`, keep all skill rules.
- [ ] Update `README.md` and add an `## [Unreleased]` entry in `CHANGELOG.md`.
- [ ] Add a lint job (path-filtered to `e2e/**`, `package.json`) to CI without touching the existing `check` job steps.
- [ ] Add `CODEOWNERS` entries for `postman/`, `e2e/`, and the new workflow files.
- [ ] Add a pull request template with a checklist: ticket ID, TC IDs in test names, tags, no secrets.

## Acceptance criteria

- [ ] AC1 — Repository visibility decision is recorded. No COAD environment file, account data, automation code, or Security QC content is merged while the repository is public.
- [ ] AC2 — On a clean clone, `npm ci && npm run lint` passes.
- [ ] AC3 — `./scripts/sync-skills.sh --check` still passes and the existing `check` workflow is green.
- [ ] AC4 — `AGENTS.md` no longer says the repository ships no code, and still tells agents to edit `.codex/skills/` only.
- [ ] AC5 — `git ls-files | grep DS_Store` returns nothing.
- [ ] AC6 — `.postman/` files are tracked and contain only IDs and paths.

## Deliverables

- Folder skeleton, `package.json`, `.nvmrc`, `tsconfig.json`, ESLint and Prettier config.
- Updated `.gitignore`, `AGENTS.md`, `README.md`, `CHANGELOG.md`, `CODEOWNERS`, `.github/pull_request_template.md`.

## Open questions

- Single root `package.json`, or npm workspaces with separate `postman/` and `e2e/` packages? Default: single root package until a second package needs its own dependencies.
- Should automation releases follow the plugin version in `scripts/bump-version.sh`, or stay unversioned? Default: unversioned.

## References

- [AGENTS.md](../../AGENTS.md)
- [.github/workflows/check.yml](../../.github/workflows/check.yml)
- [.postman/resources.yaml](../../.postman/resources.yaml)
