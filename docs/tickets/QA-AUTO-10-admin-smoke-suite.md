# QA-AUTO-10 — Admin E2E smoke suite

| Field | Value |
| --- | --- |
| Type | Story |
| Size | M |
| Phase | 2 E2E |
| Depends on | QA-AUTO-07 |
| Blocks | QA-AUTO-11 |
| Labels | `automation`, `e2e`, `admin`, `smoke` |

## Context

Evidence about the Admin platform is indirect:

- Advertisers can submit a campaign version for review but must not approve or schedule it themselves, so a privileged reviewer exists. It is likely, but not confirmed, that this reviewer works on the Admin platform.
- The `coad-qa-test-cases` skill treats Admin as an independent platform with its own permissions and workflows.

The Admin role model is an open question in QA-AUTO-02.

## Goal

A fast, stable `@smoke` suite that proves the Admin platform's critical paths work after every change.

## Scope

### In scope

- Selecting 5–10 P1 paths with the PO and manual QA.
- Page objects and tests for those paths, with API-based data setup and cleanup.

### Out of scope

- Full regression for Admin.
- The end-to-end approval flow across platforms (QA-AUTO-11).

## Candidate smoke paths (confirm with PO)

| # | Candidate | Basis |
| --- | --- | --- |
| 1 | Login and logout | Universal |
| 2 | Home or dashboard loads | Universal |
| 3 | Review queue lists campaign versions in `in_review` | Reviewer exists (confirm it is Admin) |
| 4 | Approve a campaign version prepared through the API | Reviewer exists (confirm) |
| 5 | Reject a campaign version with a reason | To confirm |
| 6 | Search or open an organization or user | To confirm |

## Tasks

- [ ] Run a selection session with the PO and manual QA; confirm the Admin role model and who approves campaign versions.
- [ ] Make sure each selected path has a manual test case with an ID; write missing ones with the `coad-qa-test-cases` skill.
- [ ] Build page objects for the screens involved.
- [ ] Implement tests tagged `@smoke`, titled `<TC-ID> Admin - <Module> - <Behavior>`.
- [ ] Prepare inputs (for example, a version in `in_review`) through the Advertiser API helper, so the Admin smoke suite does not depend on the Advertiser UI.
- [ ] Clean up everything with the `qa-auto-<run-id>` prefix.
- [ ] Keep the suite under 5 minutes with default workers.

## Acceptance criteria

- [ ] AC1 — The Admin role model and selected path list are signed off by the PO and recorded in this ticket.
- [ ] AC2 — Every selected path is automated, tagged `@smoke`, and carries a TC ID.
- [ ] AC3 — `npm run test:e2e:admin -- --grep @smoke` finishes in under 5 minutes.
- [ ] AC4 — 10 consecutive local runs pass, and 3 consecutive CI runs pass without retries.
- [ ] AC5 — No `qa-auto-` entities remain after a run; approved test campaigns are deactivated or deleted.

## Deliverables

- `e2e/pages/admin/`, `e2e/tests/admin/`
- New or updated manual test cases for selected paths.

## Open questions

- Which Admin roles exist, and which one approves campaign versions?
- Can an approved test campaign go live and affect real delivery on DEV? If yes, how is it neutralized?
- Does Admin need 2FA, and is a DEV bypass available (ADR-001)?

## References

- [QA-AUTO-07](QA-AUTO-07-playwright-framework-3-projects.md) — conventions.
- [QA-AUTO-02](QA-AUTO-02-environments-accounts-secrets.md) — account matrix.
