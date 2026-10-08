# QA-AUTO-08 — Advertiser E2E smoke suite

| Field | Value |
| --- | --- |
| Type | Story |
| Size | M |
| Phase | 2 E2E |
| Depends on | QA-AUTO-07 |
| Blocks | QA-AUTO-11 |
| Labels | `automation`, `e2e`, `advertiser`, `smoke` |

## Context

What the repository and Postman workspace show about the Advertiser platform:

- Campaigns have versions. A version can be saved as draft and submitted for review (status `in_review`). An Advertiser must not approve or schedule its own version — approval belongs to another role.
- Organizations have members with roles Owner, Supervisor, and Member. An Owner can change another member's role; members cannot raise their own role.
- Organizations contain groups with memberships.
- The `coad-qa-test-cases` skill uses "campaign changes from Draft to Active after approval" as an example scenario.

No COAD platform reference (screens, routes) exists in this repository, so screen-level steps come from the manual suite and the PO.

## Goal

A fast, stable `@smoke` suite that proves the Advertiser platform's critical paths work after every change.

## Scope

### In scope

- Selecting 5–10 P1 paths with the PO and manual QA.
- Page objects and tests for those paths, with API-based data setup and cleanup.

### Out of scope

- Full regression for Advertiser.
- Flows that need the Admin platform (QA-AUTO-11).

## Candidate smoke paths (confirm with PO)

| # | Candidate | Basis |
| --- | --- | --- |
| 1 | Login and logout | Universal |
| 2 | Home or dashboard loads for a Member | Universal |
| 3 | Create a campaign and save a draft version | Security QC positive control |
| 4 | Submit a draft version for review → status `in_review` | Security QC positive case |
| 5 | Member sees no approve or schedule action on own version | Authorization fix area |
| 6 | Owner opens member list and changes another member's role | Security QC positive control |
| 7 | Member sees no role-edit action for self or others | Authorization fix area |

Every candidate is unconfirmed until the PO agrees. Replace or add paths from the manual regression suite as needed.

## Tasks

- [ ] Run a 1-hour selection session with the PO and manual QA. Criteria: business-critical, high traffic, historically buggy, stable enough to automate.
- [ ] Make sure each selected path has a manual test case with an ID; write missing ones with the `coad-qa-test-cases` skill.
- [ ] Build page objects for the screens involved.
- [ ] Implement tests tagged `@smoke`, titled `<TC-ID> Advertiser - <Module> - <Behavior>`.
- [ ] Create data through the API helper; clean up everything with the `qa-auto-<run-id>` prefix.
- [ ] Keep the suite under 5 minutes with default workers.

## Acceptance criteria

- [ ] AC1 — The selected path list is signed off by the PO and recorded in this ticket.
- [ ] AC2 — Every selected path is automated, tagged `@smoke`, and carries a TC ID.
- [ ] AC3 — `npm run test:e2e:advertiser -- --grep @smoke` finishes in under 5 minutes.
- [ ] AC4 — 10 consecutive local runs pass, and 3 consecutive CI runs pass without retries.
- [ ] AC5 — No `qa-auto-` entities remain after a run.

## Deliverables

- `e2e/pages/advertiser/`, `e2e/tests/advertiser/`
- New or updated manual test cases for selected paths.

## Open questions

- Which role approves campaign versions — Admin, or a privileged Advertiser role?
- Which campaign statuses exist beyond `draft`, `in_review`, and scheduled, and which matter for smoke?
- Are groups and memberships managed on the Advertiser platform, the Admin platform, or both?

## References

- [QA-AUTO-07](QA-AUTO-07-playwright-framework-3-projects.md) — conventions.
- Postman workspace collection "COAD Security QC".
