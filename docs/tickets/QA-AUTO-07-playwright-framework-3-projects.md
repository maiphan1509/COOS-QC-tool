# QA-AUTO-07 — Playwright framework with Advertiser, Publisher, Admin projects

| Field | Value |
| --- | --- |
| Type | Story |
| Size | L |
| Phase | 2 E2E |
| Depends on | QA-AUTO-03 |
| Blocks | QA-AUTO-08, QA-AUTO-09, QA-AUTO-10, QA-AUTO-12, QA-AUTO-14 |
| Labels | `automation`, `e2e`, `playwright` |

## Context

COAD has three platforms — Advertiser, Publisher, Admin — each with its own permissions, workflows, and UI. There is no UI automation today. ADR-001 (QA-AUTO-03) defines how to log in programmatically and ADR-002 defines test-data handling.

## Goal

One Playwright code base with three Playwright projects (one per platform) plus a cross-platform project, shared login through `storageState`, and conventions that keep tests stable and readable.

## Scope

### In scope

- `e2e/playwright.config.ts` with projects, environment loading, reporters, and failure artifacts.
- Authentication setup project and per-role `storageState`.
- Page objects, fixtures, API helper for test data, tagging, lint rules.
- One "hello world" test per platform proving the wiring.

### Out of scope

- Real smoke suites (QA-AUTO-08, 09, 10).
- CI workflow (QA-AUTO-12).
- Visual regression, accessibility, and performance testing.

## Design

```text
e2e/
├── playwright.config.ts
├── setup/
│   └── auth.setup.ts      # logs in each role, writes e2e/.auth/<platform>-<role>.json
├── pages/
│   ├── advertiser/
│   ├── publisher/
│   └── admin/
├── fixtures/
│   └── index.ts           # extends test: page objects, API client, test-data helper, extra role contexts
├── tests/
│   ├── advertiser/
│   ├── publisher/
│   ├── admin/
│   └── cross-platform/
├── data/                  # factories, qa-auto-<run-id> name helper
└── utils/
```

**Projects in `playwright.config.ts`:**

| Project | testDir | baseURL | Default storageState | Depends on |
| --- | --- | --- | --- | --- |
| `setup` | `setup/` | — | — | — |
| `advertiser` | `tests/advertiser` | Advertiser URL | Advertiser Member | `setup` |
| `publisher` | `tests/publisher` | Publisher URL | Publisher Member | `setup` |
| `admin` | `tests/admin` | Admin URL | Admin reviewer (confirm role) | `setup` |
| `cross-platform` | `tests/cross-platform` | none (each context sets its own) | none | `setup` |

**Defaults:**

- Chromium only. Cross-browser runs are an open question.
- `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`.
- Retries: 0 locally, 2 in CI. Retried passes are reported as flaky, never hidden.
- Reporters: `list` and `html` locally; add `junit` and `blob` in CI.
- Fixed locale and timezone so date assertions are deterministic.
- Typed config module validates required environment variables at start-up and fails with the variable name.
- Tags with the `tag` option: `@smoke`, `@regression`, `@security`, `@quarantine`; `@quarantine` excluded by default.

**Locator policy:** `getByRole`, `getByLabel`, `getByText`, `getByTestId` only. No CSS chains or XPath. Ask the dev team for `data-testid` where roles and labels are not unique.

**Test data:** create and remove data through the authenticated `request` fixture (faster and steadier than the UI). All names use the `qa-auto-<run-id>` prefix from ADR-002.

**Multiple roles in one test:** a fixture opens extra browser contexts with other roles' `storageState`.

## Tasks

- [ ] Install `@playwright/test` (pinned) and configure projects as above.
- [ ] Implement `setup/auth.setup.ts` per ADR-001: one login per role, saved to `e2e/.auth/` (gitignored).
- [ ] Implement the typed environment config with `.env` support.
- [ ] Create base page objects (login, layout and navigation) per platform.
- [ ] Implement fixtures: page objects, API client, test-data helper with cleanup, extra role contexts.
- [ ] Add ESLint rules from `eslint-plugin-playwright`: no `waitForTimeout`, no focused tests, no conditional expects.
- [ ] Add npm scripts: `test:e2e`, `test:e2e:advertiser`, `test:e2e:publisher`, `test:e2e:admin`, `test:e2e:smoke` (`--grep @smoke`), `test:e2e:report`.
- [ ] Add one hello-world test per platform: authenticated user lands on the platform's home screen.
- [ ] Write `docs/automation/playwright-conventions.md`: structure, locator policy, page-object rules, tagging, test naming with TC IDs, data handling.
- [ ] Send the dev team a `data-testid` request list for screens the smoke suites will touch.

## Acceptance criteria

- [ ] AC1 — `npx playwright test --project=advertiser` (and `publisher`, `admin`) passes the hello-world test locally against DEV using only `.env`.
- [ ] AC2 — The `setup` project logs in once per role; other tests reuse `storageState` and do not pass through the login UI (except dedicated login tests).
- [ ] AC3 — Removing a required environment variable stops the run before any test, naming the variable.
- [ ] AC4 — A deliberately failing test produces a trace, screenshot, and video; the HTML report opens with them attached.
- [ ] AC5 — `e2e/.auth/` is gitignored and excluded from every artifact upload (it holds live session cookies).
- [ ] AC6 — Lint fails on `page.waitForTimeout` and on `test.only`.
- [ ] AC7 — Conventions doc merged.

## Deliverables

- `e2e/` framework code, `playwright.config.ts`
- `docs/automation/playwright-conventions.md`
- `data-testid` request sent to the dev team.

## Open questions

- Do we need Firefox or WebKit coverage? If so, only nightly, or also on pull requests?
- Which timezone and locale do COAD users mostly use (affects date and number assertions)?
- Which Admin role is the default for the `admin` project?

## References

- [QA-AUTO-03](QA-AUTO-03-spike-auth-test-data.md) — ADR-001, ADR-002.
- `.codex/skills/coad-qa-test-cases/SKILL.md` — platform independence and test naming.
