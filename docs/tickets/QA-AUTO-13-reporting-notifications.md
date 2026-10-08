# QA-AUTO-13 — Test reporting and failure notifications

| Field | Value |
| --- | --- |
| Type | Task |
| Size | M |
| Phase | 3 Operate |
| Depends on | QA-AUTO-04, QA-AUTO-12 |
| Blocks | — |
| Labels | `automation`, `ci`, `reporting` |

## Context

After QA-AUTO-04 and QA-AUTO-12, the API and E2E workflows each produce JUnit and HTML artifacts. Nobody is told when a nightly run fails, and there is no single view of how the suites trend over time.

## Goal

The team learns about nightly failures without opening GitHub, and anyone can see the current health of both suites in one place.

## Scope

### In scope

- Consistent job summaries for both workflows.
- Failure and recovery notifications to the team channel.
- A decision on report hosting and trend history.

### Out of scope

- Dashboards outside GitHub and the chosen channel.

## Tasks

- [ ] Standardize the job summary in both workflows: suite, environment, passed / failed / flaky / skipped, duration, list of failing tests with links.
- [ ] Add a notification step on nightly runs: send on failure, and once on the first green run after a failure (recovery). Message: workflow, environment, counts, top 5 failures, link to the run.
- [ ] Store the channel webhook URL as a secret in `coad-dev`.
- [ ] Decide report hosting and record it in `docs/automation/decisions/ADR-004-reporting.md`. Options:
  - **Artifacts only** — no extra setup; reports expire with retention.
  - **GitHub Pages** — stable link; requires a paid plan for a private repository, and private Pages access control only exists on GitHub Enterprise Cloud (verify for this organization).
  - **Allure with history** — trend charts; more setup and storage.
  Recommendation: start with artifacts plus job summaries; revisit when trend data is needed.
- [ ] Define a daily triage owner (rota) who acknowledges each failure notification.

## Acceptance criteria

- [ ] AC1 — A forced nightly failure sends one notification containing counts, top failures, and a working run link.
- [ ] AC2 — The next green nightly run sends one recovery message; further green runs send nothing.
- [ ] AC3 — Notifications contain no credentials, cookies, tokens, or personal data.
- [ ] AC4 — Both workflows show the same summary layout.
- [ ] AC5 — ADR-004 is approved, and the triage rota is published in the runbook.

## Deliverables

- Updated `api-tests.yml` and `e2e-tests.yml`
- `docs/automation/decisions/ADR-004-reporting.md`

## Open questions

- Slack, Microsoft Teams, or email?
- Should a failing security suite (QA-AUTO-05) notify a different or additional audience?

## References

- [QA-AUTO-04](QA-AUTO-04-postman-api-ci-schedule.md), [QA-AUTO-12](QA-AUTO-12-playwright-ci-pipeline.md)
