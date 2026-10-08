# QA-AUTO-12 — Playwright CI pipeline

| Field | Value |
| --- | --- |
| Type | Story |
| Size | M |
| Phase | 2 E2E |
| Depends on | QA-AUTO-07 |
| Blocks | QA-AUTO-13 |
| Labels | `automation`, `e2e`, `ci` |

## Context

The Playwright framework (QA-AUTO-07) runs locally. GitHub Actions is the CI platform (decided 2026-10-08). The API suite runs nightly at 01:00 ICT (QA-AUTO-04); E2E should not overlap it on the same DEV data.

## Goal

E2E tests run automatically: smoke on pull requests, full regression and cross-platform flows every night, and on demand — fast enough that people wait for the result.

## Scope

### In scope

- `.github/workflows/e2e-tests.yml` with three triggers.
- Project matrix, sharding, merged reports, browser caching.
- Required status check for pull requests.

### Out of scope

- Notifications and report hosting (QA-AUTO-13).

## Design

| Trigger | What runs | Environment |
| --- | --- | --- |
| `pull_request` on `e2e/**`, `package*.json` | `@smoke` for `advertiser`, `publisher`, `admin` | `coad-dev` |
| `schedule` `30 18 * * *` (01:30 ICT, confirm) | All projects except `@quarantine`, including `cross-platform` | `coad-dev` |
| `workflow_dispatch` with inputs `env`, `project`, `grep` | Selected | Selected |

- Run inside the official Playwright container image pinned to the same version as `@playwright/test`, or install browsers with `npx playwright install --with-deps chromium` and cache `~/.cache/ms-playwright` keyed on the version.
- Matrix: project × shard (`--shard=i/n`), `fail-fast: false`.
- Each shard writes a `blob` report; a final job merges them with `npx playwright merge-reports` into HTML and JUnit.
- `concurrency`: cancel in-progress runs for the same pull request; one nightly run per environment at a time.
- `timeout-minutes` on every job.
- Artifacts: merged HTML report (14 days), traces and screenshots only for failures (7 days). Never upload `e2e/.auth/`.
- Retries: 2 in CI; flaky results reported separately in the summary.
- Each shard runs the `setup` project and logs in itself. If ADR-001 finds a single-session or login rate-limit rule, use one account per shard or reduce shard count.

Traces and screenshots can contain personal data and session details; this is one more reason the repository must be private (QA-AUTO-01 AC1).

## Tasks

- [ ] Write `.github/workflows/e2e-tests.yml` as designed.
- [ ] Choose the shard count from measured suite duration (start with 2 per project for nightly, 1 for pull requests).
- [ ] Add the merge-reports job and publish JUnit results to the job summary.
- [ ] Add the pull request smoke job as a required status check.
- [ ] Verify artifact contents contain no `storageState` files.
- [ ] Document how to download and open a report and trace in `docs/automation/README.md`.

## Acceptance criteria

- [ ] AC1 — A pull request changing `e2e/**` runs smoke for all three platforms in under 10 minutes wall time, and a failure blocks the merge.
- [ ] AC2 — The nightly run completes for 3 consecutive nights and produces one merged HTML report.
- [ ] AC3 — The job summary shows passed, failed, flaky, and skipped counts with failing test names.
- [ ] AC4 — `workflow_dispatch` runs a single project with a custom `grep`.
- [ ] AC5 — No artifact contains files from `e2e/.auth/` (checked by listing artifact contents).
- [ ] AC6 — A second browser-cache hit run is measurably faster than the first (record both durations).

## Deliverables

- `.github/workflows/e2e-tests.yml`
- Runbook section on reports and traces.

## Open questions

- Should app-repository deployments to DEV trigger the E2E smoke suite (`repository_dispatch`)?
- Is GitHub-hosted runner capacity enough, or does the self-hosted runner from QA-AUTO-02 need more resources?

## References

- [QA-AUTO-07](QA-AUTO-07-playwright-framework-3-projects.md), [QA-AUTO-04](QA-AUTO-04-postman-api-ci-schedule.md)
