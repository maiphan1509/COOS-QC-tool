# QA-AUTO-14 — Runbook, flaky-test policy, and ownership

| Field | Value |
| --- | --- |
| Type | Task |
| Size | S |
| Phase | 3 Operate |
| Depends on | QA-AUTO-04, QA-AUTO-07 |
| Blocks | — |
| Labels | `automation`, `docs`, `process` |

## Context

Automation only stays useful if people can run it, trust its failures, and know who fixes what. Conventions docs from QA-AUTO-04 and QA-AUTO-07 cover how to write tests; this ticket covers how to run, triage, and maintain them.

This repository also ships the `coad-qa-test-cases` skill, which produces automation-friendly manual test cases with IDs. Linking those IDs to automated tests keeps coverage visible.

## Goal

A new QA engineer can run, debug, and extend both suites from the runbook alone, and flaky tests are handled by rule rather than by habit.

## Scope

### In scope

- Runbook, triage guide, flaky-test policy, ownership, traceability, agent instructions.

### Out of scope

- New tests.

## Tasks

- [ ] Write `docs/automation/README.md` (runbook):
  - Prerequisites and first-time setup (`.env` from `.env.example`, Postman Native Git link).
  - Run API and E2E suites locally: all, one platform, one test, smoke only.
  - Debug: Playwright trace viewer, UI mode, Postman CLI verbose output.
  - Refresh `storageState` when login changes.
  - Checklist for adding a new test.
- [ ] Write a triage guide: classify each failure as product bug, test bug, environment, test data, or flaky; the action for each; a bug template with run link, trace, and TC ID.
- [ ] Flaky-test policy:
  - A test that fails and then passes on retry is flaky.
  - Flaky twice in 7 days → tag `@quarantine` and open a fix ticket.
  - Fix or delete within 5 working days.
  - Quarantined tests run nightly in a non-blocking job so they can prove they are fixed.
  - Quarantine never exceeds 10% of a suite; above that, stop adding tests and fix.
- [ ] Ownership: `CODEOWNERS` per platform folder (`e2e/tests/advertiser/` and so on) and per collection.
- [ ] Traceability: TC ID in every test name; add an "Automated by" column to the manual suites produced by `coad-qa-test-cases`; a small script lists automated TC IDs from both suites.
- [ ] Add a section to `AGENTS.md` telling agents to create or update test cases with `coad-qa-test-cases` before writing automation, and to follow `docs/automation/` conventions.
- [ ] Monthly maintenance review: suite duration, flaky rate, quarantine size, P1 coverage.

## Acceptance criteria

- [ ] AC1 — An engineer who did not build the framework runs both suites locally using only the runbook; gaps they hit are fixed in the runbook.
- [ ] AC2 — The flaky-test policy is approved by the QA lead.
- [ ] AC3 — `CODEOWNERS` requests reviews from the right owner on a test pull request.
- [ ] AC4 — The traceability script outputs the automated TC IDs for both suites.
- [ ] AC5 — The first monthly review date is on the team calendar.

## Deliverables

- `docs/automation/README.md`, triage guide, flaky policy
- `CODEOWNERS` updates, `AGENTS.md` section, traceability script

## Open questions

- Where do the manual test suites live (Excel in a shared drive, a test management tool)? Decides where the "Automated by" column goes.

## References

- [QA-AUTO-04](QA-AUTO-04-postman-api-ci-schedule.md), [QA-AUTO-07](QA-AUTO-07-playwright-framework-3-projects.md)
- `.codex/skills/coad-qa-test-cases/SKILL.md`
