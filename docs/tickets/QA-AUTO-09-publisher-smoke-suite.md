# QA-AUTO-09 — Publisher E2E smoke suite

| Field | Value |
| --- | --- |
| Type | Story |
| Size | M |
| Phase | 2 E2E |
| Depends on | QA-AUTO-07 |
| Blocks | — |
| Labels | `automation`, `e2e`, `publisher`, `smoke` |

## Context

Very little about the Publisher platform is documented in this repository. The only evidence is in the Security QC collection: the Publisher platform has member role management, reachable through a main route and a legacy route, and a Member must not raise their own role through either.

Because the evidence is thin, path selection with the PO is the first and largest task. Do not assume Publisher features from other products.

## Goal

A fast, stable `@smoke` suite that proves the Publisher platform's critical paths work after every change.

## Scope

### In scope

- Discovering and selecting 5–10 P1 paths with the PO and manual QA.
- Page objects and tests for those paths, with API-based data setup and cleanup.

### Out of scope

- Full regression for Publisher.

## Candidate smoke paths (confirm with PO)

| # | Candidate | Basis |
| --- | --- | --- |
| 1 | Login and logout | Universal |
| 2 | Home or dashboard loads for a Member | Universal |
| 3 | Owner changes another member's role | Role management exists |
| 4 | Member sees no role-edit action for self | Authorization fix area |
| 5+ | Core Publisher business flows | Unknown — to be supplied by the PO |

## Tasks

- [ ] Run a selection session with the PO and manual QA; first list the Publisher platform's main modules, then pick P1 paths.
- [ ] Record the module list in this ticket; it also feeds the optional COAD platform reference (epic open question 10).
- [ ] Make sure each selected path has a manual test case with an ID; write missing ones with the `coad-qa-test-cases` skill.
- [ ] Build page objects for the screens involved.
- [ ] Implement tests tagged `@smoke`, titled `<TC-ID> Publisher - <Module> - <Behavior>`.
- [ ] Create data through the API helper; clean up everything with the `qa-auto-<run-id>` prefix.
- [ ] Keep the suite under 5 minutes with default workers.

## Acceptance criteria

- [ ] AC1 — The Publisher module list and selected path list are signed off by the PO and recorded in this ticket.
- [ ] AC2 — Every selected path is automated, tagged `@smoke`, and carries a TC ID.
- [ ] AC3 — `npm run test:e2e:publisher -- --grep @smoke` finishes in under 5 minutes.
- [ ] AC4 — 10 consecutive local runs pass, and 3 consecutive CI runs pass without retries.
- [ ] AC5 — No `qa-auto-` entities remain after a run.

## Deliverables

- `e2e/pages/publisher/`, `e2e/tests/publisher/`
- Publisher module list; new or updated manual test cases.

## Open questions

- What are the Publisher platform's main modules and P1 business flows?
- Is the legacy role-management route still reachable from the UI, or API only?
- Does the Publisher platform see Advertiser campaign changes (cross-platform impact for QA-AUTO-11)?

## References

- [QA-AUTO-07](QA-AUTO-07-playwright-framework-3-projects.md) — conventions.
- Postman workspace collection "COAD Security QC".
