# QA-AUTO-05 — Make the Security QC collection CI-ready

| Field | Value |
| --- | --- |
| Type | Story |
| Size | M |
| Phase | 1 API |
| Depends on | QA-AUTO-04 |
| Blocks | — |
| Labels | `automation`, `api`, `security` |

## Context

The Postman workspace holds "COAD Security QC", a manual collection that verifies three authorization fixes: an unauthorized status change on a campaign version, role self-elevation by a member, and deleting a membership outside the caller's group or organization. It has 3 folders and 15 requests, including a data-driven sweep that uses the Collection Runner with a CSV file.

Manual dependencies today:

- Session cookie and XSRF token copied by hand from a browser.
- Entity IDs (campaign, version, accounts, groups, memberships) filled by hand.
- Some cases change data on pre-fix code and must be undone by hand.
- The collection itself says a result must be confirmed in the UI or database, never from the HTTP status alone.

**Sensitivity.** This collection describes how to attempt privilege escalation on COAD. It must never live in a public repository or a public Postman workspace.

## Goal

The collection runs unattended in CI as a nightly security regression, proves each result with a post-condition check, and always leaves data as it found it.

## Scope

### In scope

- Move the collection into the `postman/` layout as `COAD API - Security`.
- Automatic login for every session the cases need.
- Fixture setup, post-condition checks, and guaranteed teardown.
- Nightly and on-demand runs with the `@security` tag.

### Out of scope

- New security cases beyond the existing three areas (raise follow-up tickets).
- Penetration testing.

## Tasks

- [ ] Confirm the repository is private (QA-AUTO-01 AC1) before committing anything from this collection.
- [ ] Pull the collection through Native Git into `postman/collections/`.
- [ ] Replace manual cookie and XSRF handling with `_setup` logins for each session the cases need (Advertiser member, Owner, Member, Publisher member, organization A).
- [ ] Provide fixtures per ADR-002: either create them in `_setup` (campaign with a draft version, groups and memberships in organizations A and B) or reference pre-provisioned fixtures from the QA-AUTO-02 account matrix.
- [ ] Keep "follow redirects" disabled on every request.
- [ ] Add a post-condition GET after each negative case proving nothing changed (version status, role, membership still present).
- [ ] Add a teardown that restores any role or membership a failing negative case changed, so a regression never leaves escalated privileges behind.
- [ ] Move the CSV for the status sweep into `postman/data/` and run that folder with the CLI data-file option in its own step.
- [ ] Add the collection to the nightly matrix in `api-tests.yml`; exclude it from pull request smoke.

## Acceptance criteria

- [ ] AC1 — The collection runs in CI on DEV with no manual step; all 15 requests pass against the fixed build.
- [ ] AC2 — Every negative case has a post-condition assertion, not only a status-code assertion.
- [ ] AC3 — Two consecutive runs both pass, and a GET after the second run shows roles and memberships unchanged from before the first.
- [ ] AC4 — A failing case names the authorization area and test case ID in the job summary.
- [ ] AC5 — The collection exists only in private locations (repository and Postman workspace).

## Deliverables

- `postman/collections/COAD API - Security/`
- `postman/data/` sweep data file
- Updated `.github/workflows/api-tests.yml`

## Open questions

- Should this suite also run after every DEV deployment, not only nightly?
- Who is told first when a security case fails: the QA lead, the dev lead, or a security owner?

## References

- Postman workspace collection "COAD Security QC" (collection description, variables, folder structure).
- [QA-AUTO-04](QA-AUTO-04-postman-api-ci-schedule.md) — conventions and workflow.
