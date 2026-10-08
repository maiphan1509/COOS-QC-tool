# QA-AUTO-02 — Environments, test accounts, and secrets management

| Field | Value |
| --- | --- |
| Type | Task |
| Size | M |
| Phase | 0 Foundation |
| Depends on | QA-AUTO-01 |
| Blocks | QA-AUTO-03 |
| Labels | `automation`, `infra`, `security` |

## Context

- `.postman/resources.yaml` references `postman/environments/COAD DEV (360stech).environment.yaml`; the file is not in the repository yet.
- The existing Security QC collection authenticates with a Laravel session cookie, an XSRF token, and an organization-context cookie, captured by hand from a browser. Its description says these values must never be committed.
- The collection mentions DEV and UAT environments.
- The Security QC collection's variables show that authorization checks need at least two organizations and several groups inside one organization, plus Owner, Supervisor, and Member roles.

Automation cannot run unattended until environments, accounts, and secrets are defined.

## Goal

Every automated run knows where to go, which accounts to use, and where secrets come from — with no secret in the repository.

## Scope

### In scope

- Environment matrix and network reachability from CI.
- Dedicated automation accounts per platform and role.
- GitHub Environments and Secrets; local `.env` handling.
- Secret scanning in CI.

### Out of scope

- How login is performed programmatically (QA-AUTO-03).
- Test data creation and cleanup (QA-AUTO-03).

## Tasks

- [ ] Write `docs/automation/environments.md`: environment, base URL per platform (Advertiser, Publisher, Admin), purpose, data reset policy, owner. Values confirmed by the dev lead.
- [ ] Reachability probe: a temporary `workflow_dispatch` job on the intended runner type requests each login page and prints only the HTTP status.
- [ ] If DEV is not reachable from GitHub-hosted runners, decide between an IP allowlist and a self-hosted runner inside the company network. Record the decision in `environments.md`. (GitHub-hosted IP ranges are large and change; a self-hosted runner is usually the safer choice.)
- [ ] Define the account matrix in `docs/automation/accounts.md` — role and purpose only, never passwords:

  | Platform | Role | Organization | Purpose |
  | --- | --- | --- | --- |
  | Advertiser | Owner | Org A | Member management, positive controls |
  | Advertiser | Supervisor | Org A | Role-boundary checks |
  | Advertiser | Member | Org A | Day-to-day flows, negative permission checks |
  | Advertiser | Owner | Org B | Cross-organization isolation |
  | Publisher | Owner | to confirm | Member management |
  | Publisher | Member | to confirm | Negative permission checks |
  | Admin | to confirm | — | Review and approval flows |

- [ ] Request the accounts from the account owner. Automation accounts are dedicated: not personal, not shared with manual testers.
- [ ] Create GitHub Environments `coad-dev` (and `coad-uat` if in scope, with required reviewers).
- [ ] Secret naming: `COAD_<PLATFORM>_<ROLE>[_<ORG>]_EMAIL` and `_PASSWORD`, plus `POSTMAN_API_KEY` from a service account. Non-secret base URLs go in Environment variables, not Secrets.
- [ ] Commit `.env.example` with every key and no values; `.env` stays ignored.
- [ ] Pull the Postman environment file from the workspace, blank every secret value, commit keys only. Local values live in Postman current values or the Postman Vault.
- [ ] Add gitleaks (or equivalent) to CI on every pull request, with extra rules for session cookies, XSRF tokens, and Postman API keys (`PMAK-` prefix).
- [ ] Document a rotation policy: when passwords rotate, who rotates, what to update.

## Acceptance criteria

- [ ] AC1 — `environments.md` lists base URLs for all three platforms on DEV (and UAT if in scope), confirmed by the dev lead.
- [ ] AC2 — The reachability probe on the chosen runner type gets HTTP 200 from all three login pages; the run link is attached to this ticket.
- [ ] AC3 — Every account in the matrix exists and can log in manually.
- [ ] AC4 — A workflow in `coad-dev` reads the secrets; values appear masked (`***`) in logs.
- [ ] AC5 — The secret scan fails a throwaway branch containing a fake session cookie, and passes on `main`.
- [ ] AC6 — The committed Postman environment file contains no non-empty secret value.

## Deliverables

- `docs/automation/environments.md`, `docs/automation/accounts.md`
- `.env.example`, `postman/environments/*.environment.yaml` (keys only)
- Secret-scan workflow or job; GitHub Environments configured.

## Open questions

- Does COAD enforce a single active session per account? If yes, parallel CI jobs need separate accounts per job.
- Is the Admin platform role model known (super admin, reviewer, other)? Needed to finish the matrix.
- Which Publisher organization setup mirrors the Advertiser one?
- Who owns the Postman service account and its API key?

## References

- [.postman/resources.yaml](../../.postman/resources.yaml)
- Postman workspace collection "COAD Security QC" — collection description and variables.
