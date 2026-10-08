# QA-AUTO-06 — API coverage inventory and contract tests from `COAD.yaml`

| Field | Value |
| --- | --- |
| Type | Story |
| Size | L |
| Phase | 1 API |
| Depends on | QA-AUTO-04 |
| Blocks | — |
| Labels | `automation`, `api`, `contract` |

## Context

- The Postman workspace has a spec `COAD.yaml`, mapped locally to `postman/specs/COAD/COAD.yaml` in `.postman/resources.yaml`. The file is not in the repository yet; its completeness is unknown.
- `.postman/workflows.yaml` syncs the spec with the Security QC collection in both directions, with `deleteOrphanedRequests: false` and `syncExamples: false`.
- Without an inventory, nobody can say which endpoints are tested.

## Goal

A prioritized endpoint inventory, full coverage of the highest-priority endpoints, and contract tests that catch response-shape changes.

## Scope

### In scope

- Pull and lint the spec.
- Endpoint inventory with priority and coverage mapping.
- Positive and negative tests for P1 endpoints.
- Response-schema checks for P1 JSON endpoints.

### Out of scope

- P2 and P3 coverage (create follow-up tickets).
- Writing the spec on behalf of the dev team; gaps are reported, not invented.

## Tasks

- [ ] Pull `COAD.yaml` into `postman/specs/COAD/` and lint it (Postman spec lint or Spectral). Add the lint to `api-tests.yml`.
- [ ] Build `docs/automation/api-coverage.md` (or a CSV next to it) with columns: platform, method, path, auth role, mutating (yes/no), priority, test case IDs, automated (yes/no).
- [ ] Priority rules:
  - **P1** — status transitions, permission and tenant boundaries (organization, group), money or budget fields, anything on a smoke path.
  - **P2** — other mutating endpoints.
  - **P3** — read-only endpoints.
- [ ] Review the inventory with the dev lead; list endpoints that exist in the product but not in the spec, and the reverse.
- [ ] For each P1 endpoint, add at least one positive and one negative or permission test to the platform collection.
- [ ] Add schema validation for P1 JSON responses, using schemas taken from the spec.
- [ ] Decide whether regression collections sync with the spec; update `.postman/workflows.yaml` only if the answer is yes, keeping `deleteOrphanedRequests: false`.
- [ ] Generated requests from the spec do not count as coverage until they have assertions.

## Acceptance criteria

- [ ] AC1 — The inventory covers every path in `COAD.yaml` and is reviewed by the dev lead.
- [ ] AC2 — Spec lint runs in CI and fails on spec errors.
- [ ] AC3 — 100% of P1 endpoints have at least one positive and one negative or permission test, each with a test case ID.
- [ ] AC4 — Every P1 JSON endpoint has a schema assertion; changing a required field in a mock response makes the test fail.
- [ ] AC5 — Spec gaps found during review are filed as dev tickets and linked here.
- [ ] AC6 — Follow-up tickets exist for P2 and P3 coverage.

## Deliverables

- `postman/specs/COAD/COAD.yaml`
- `docs/automation/api-coverage.md`
- New requests and tests in the platform collections.

## Open questions

- Is `COAD.yaml` maintained by the dev team, or was it generated once? Who updates it when routes change?
- Are web routes (redirect or HTML responses) in scope for the inventory, or only JSON endpoints?

## References

- [.postman/resources.yaml](../../.postman/resources.yaml), [.postman/workflows.yaml](../../.postman/workflows.yaml)
- [QA-AUTO-04](QA-AUTO-04-postman-api-ci-schedule.md) — test-script standard.
