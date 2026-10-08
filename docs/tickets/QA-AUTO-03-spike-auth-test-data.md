# QA-AUTO-03 — Spike: authentication and test data strategy

| Field | Value |
| --- | --- |
| Type | Spike (timebox: 3 working days) |
| Size | M |
| Phase | 0 Foundation |
| Depends on | QA-AUTO-02 |
| Blocks | QA-AUTO-04, QA-AUTO-07 |
| Labels | `automation`, `spike` |

## Context

Today every authenticated request in the Security QC collection depends on a human: log in through a browser, copy the request as cURL, paste cookies and the XSRF token, fill entity IDs, and undo data changes afterwards. COAD is a Laravel application, so login likely needs a CSRF round trip, and responses use 302, 419, 422, 403, and 404 to signal outcomes.

Both Postman (QA-AUTO-04) and Playwright (QA-AUTO-07) need the same answers: how to log in without a human, and how to create and remove test data safely. Answering once avoids two teams discovering the same constraints.

## Goal

Two approved decision records and a minimal proof of concept that both automation tracks build on.

## Questions to answer

### Authentication

1. Login flow per platform: login URL, form fields, how the CSRF token is obtained and sent, redirect after success, session cookie name.
2. Are Advertiser, Publisher, and Admin separate domains with separate sessions, or one application with role routing?
3. How is the organization context selected after login (the organization-context cookie seen in the Security QC collection)?
4. 2FA, OTP, captcha, email verification, lockout after failed attempts, login rate limits. Can DEV offer a test-only bypass?
5. Session lifetime: does one login per run last the whole nightly run?
6. Single-session policy: does a new login end the previous session of the same account?

### Test data

7. Can automation create organizations, groups, memberships, and campaigns through the UI or HTTP endpoints?
8. Is there a seed command, factory endpoint, or database access on DEV? How often is DEV reset?
9. Which entities can be deleted, and are deletes soft or hard?
10. Can PR runs, nightly runs, and manual QA share DEV safely, or do they collide on the same data?
11. Which flows are asynchronous (queues, approvals, notifications) and need polling?
12. Do any flows need email (invitations, password reset)? Is there a mail catcher on DEV?

## Tasks

- [ ] Walk each platform's login in a browser with DevTools open; record the request sequence (no values).
- [ ] Postman proof of concept: a `_setup` request sequence that logs in and an authenticated GET returning 200, with no manual cookie paste.
- [ ] Playwright proof of concept: a setup script that logs in one role and saves `storageState`; a second test reuses it and lands on the dashboard.
- [ ] Interview the dev lead on questions 7–12.
- [ ] Write `docs/automation/decisions/ADR-001-authentication.md`.
- [ ] Write `docs/automation/decisions/ADR-002-test-data-and-cleanup.md`, including the `qa-auto-<run-id>` naming prefix and the cleanup approach.
- [ ] File requests in the dev backlog for anything automation needs from the product: test-only captcha/2FA bypass on DEV, stable `data-testid` attributes, seed endpoint, mail catcher.

## Acceptance criteria

- [ ] AC1 — Both ADRs exist, answer every question above (or record it as unresolved with an owner), and are approved by the QA lead and dev lead.
- [ ] AC2 — Postman proof of concept runs from the command line with secrets from `.env` and no manual step.
- [ ] AC3 — Playwright proof of concept saves and reuses `storageState` for one role.
- [ ] AC4 — Dev backlog requests are filed and linked from this ticket.

## Deliverables

- `docs/automation/decisions/ADR-001-authentication.md`
- `docs/automation/decisions/ADR-002-test-data-and-cleanup.md`
- Proof-of-concept code. Keep it only if it follows QA-AUTO-01 conventions; otherwise discard it.

## Out of scope

- Building the full Postman or Playwright framework.

## References

- [QA-AUTO-02](QA-AUTO-02-environments-accounts-secrets.md) — accounts and secrets.
- Postman workspace collection "COAD Security QC" — collection-level pre-request script shows the current cookie and XSRF handling.
