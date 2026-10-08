# QA-AUTO-04 — Postman API automation with scheduled CI runs

| Field | Value |
| --- | --- |
| Type | Story |
| Size | L |
| Phase | 1 API |
| Depends on | QA-AUTO-03 |
| Blocks | QA-AUTO-05, QA-AUTO-06, QA-AUTO-13, QA-AUTO-14 |
| Labels | `automation`, `api`, `postman`, `ci` |

## Context

- The repository is linked to a Postman team workspace through Native Git (`.postman/resources.yaml`). Native Git stores collections on disk as a folder of files, not as a single v2.1 JSON export.
- The workspace holds one collection (COAD Security QC), one environment (COAD DEV), one spec (`COAD.yaml`), and no monitors.
- Decision 2026-10-08: scheduled runs use GitHub Actions, not Postman Monitors.
- Authentication and test-data rules come from ADR-001 and ADR-002 (QA-AUTO-03).

## Goal

A Postman API test system that the team edits in the Postman app, reviews in pull requests, and that runs automatically: smoke on pull requests, full regression every night, and on demand.

## Scope

### In scope

- Collection structure and test-script conventions.
- Runner choice and local run command.
- GitHub Actions workflow with pull request, schedule, and manual triggers.
- JUnit and HTML reports as artifacts.

### Out of scope

- Postman Monitors (revisit only if GitHub Actions cannot reach DEV).
- Migrating the Security QC collection (QA-AUTO-05).
- Coverage inventory and contract tests (QA-AUTO-06).
- Notifications (QA-AUTO-13).
- Performance and load testing.

## Design

**Source of truth.** Files under `postman/` are the source of truth. People edit in the Postman app through Native Git and commit through pull requests. Nobody edits the cloud copy directly.

**One collection per platform**, so CI can run platforms in parallel:

```text
COAD API - Advertiser
├── _setup          # login per role (ADR-001), create shared fixtures
├── Smoke/
├── Regression/
│   └── <module>/
└── _teardown       # remove entities prefixed qa-auto-<run-id>
COAD API - Publisher       (same shape)
COAD API - Admin           (same shape)
COAD API - Cross-platform  (flows needing sessions on more than one platform)
```

PR runs select `_setup`, `Smoke`, `_teardown`; nightly runs select everything.

**Test-script standard** for every request:

- Status code assertion. Disable "follow redirects" wherever a 302, 419, 422, 403, or 404 is the expected outcome.
- Response time budget from an environment variable (default 2000 ms).
- Key fields or schema for JSON responses.
- A business post-condition for every mutating request (a follow-up GET proves the change happened, or did not).
- `pm.test` names start with the test case ID.
- Never log cookies, tokens, or request headers.

**Runner.** Postman CLI is the default because it is built for Postman's own formats. Verify in this ticket that it runs the Native Git folder layout; if it cannot, add a CI step that exports a v2.1 JSON first and record which runner was chosen (Postman CLI or Newman) and why.

**Workflow `.github/workflows/api-tests.yml`:**

| Trigger | Suite | Environment |
| --- | --- | --- |
| `pull_request` on `postman/**` | Smoke, all platforms | `coad-dev` |
| `schedule` `0 18 * * *` (01:00 ICT, confirm) | Full regression, all platforms | `coad-dev` |
| `workflow_dispatch` with inputs `env`, `suite`, `platform` | Selected | Selected |

- Matrix over the four collections, `fail-fast: false`.
- `concurrency` group per environment so two runs never share DEV data at once.
- Pinned Postman CLI version; `timeout-minutes` on every job.
- Upload JUnit XML and HTML reports, 14-day retention.
- Publish JUnit results to the job summary.
- The smoke job becomes a required status check on `main`.

Notes on GitHub scheduling: schedules run only from the default branch, can start late under load, and in a public repository are disabled after 60 days without repository activity.

## Tasks

- [ ] Verify the runner against the Native Git layout; record the result in `docs/automation/decisions/ADR-003-api-runner.md`.
- [ ] Create the four collections with `_setup`, `Smoke`, `Regression`, `_teardown`.
- [ ] Implement `_setup` login per ADR-001 and `_teardown` cleanup per ADR-002.
- [ ] Add at least one smoke request per platform (authenticated GET of a landing resource) to prove the pipeline.
- [ ] Add `npm run test:api` with options for suite, platform, and environment, reading secrets from `.env`.
- [ ] Write `.github/workflows/api-tests.yml` as designed above.
- [ ] Configure the HTML reporter to omit request and response headers, or drop the HTML report for authenticated runs if it cannot.
- [ ] Add the smoke job as a required check through branch protection.
- [ ] Write `docs/automation/postman-conventions.md`: structure, naming, test-script standard, variable scopes, how to add a request.

## Acceptance criteria

- [ ] AC1 — `npm run test:api` runs the smoke suite locally against DEV using only `.env`.
- [ ] AC2 — A pull request changing `postman/**` triggers the smoke job, and a failing assertion blocks the merge.
- [ ] AC3 — The nightly schedule runs full regression on DEV for 3 consecutive nights; JUnit and HTML artifacts are downloadable from each run.
- [ ] AC4 — A failed assertion shows the request name, test case ID, and assertion message in the job summary.
- [ ] AC5 — `workflow_dispatch` runs any combination of environment, suite, and platform.
- [ ] AC6 — Two consecutive runs both pass, and the second leaves no `qa-auto-` entities from the first.
- [ ] AC7 — No cookie, XSRF token, password, or API key appears in logs, the job summary, or artifacts (spot-checked on one passing and one failing run).

## Deliverables

- `postman/collections/` (four collections), `postman/environments/` (keys only)
- `.github/workflows/api-tests.yml`
- `docs/automation/postman-conventions.md`, `docs/automation/decisions/ADR-003-api-runner.md`

## Open questions

- Does COAD expose JSON endpoints, or mostly web routes returning redirects and HTML? This changes how much schema validation is possible.
- Should app-repository deployments to DEV trigger this workflow (`repository_dispatch`)?
- Does the Postman plan limit CLI runs or require results upload?

## References

- [QA-AUTO-03](QA-AUTO-03-spike-auth-test-data.md) — ADR-001, ADR-002.
- [.postman/workflows.yaml](../../.postman/workflows.yaml) — spec-to-collection sync settings.
