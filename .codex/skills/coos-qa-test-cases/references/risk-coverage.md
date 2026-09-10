# COOS Risk Coverage

Read this reference for every COOS test-case design request.

## Coverage model

Map confirmed requirements to applicable happy paths, negative cases, field validation, boundary values, permissions, UI behavior, business rules, status transitions, error handling, data consistency, integrations, and cross-surface effects. Do not force an inapplicable category.

After normal coverage, perform a misuse-and-mistake review. Include an edge case only when:

1. A real user, operator, or malicious user can plausibly trigger it through the product, browser, device, account, file, network, or normal integration flow.
2. Failure can cause unauthorized access, tenant or account data exposure, financial or reporting error, duplicate execution, lost or corrupted data, a bypassed rule, an invalid transition, or inconsistent state across COOS surfaces.
3. A QC can execute it through observable actions without exploit code, penetration tools, source access, packet manipulation, or deep infrastructure knowledge.

Prefer the smallest set covering distinct failure mechanisms. Do not duplicate an existing negative, permission, validation, or concurrency case under an edge-case label.

## Applicable heuristics

- Accidental behavior: double submission, refresh or Back during processing, whitespace, stale autofill, wrong account context, or repeating an action after delayed feedback.
- Simple deliberate misuse: saved restricted URL, changing a visible record identifier, expired or reused link, repeated state-changing action, or acting after permission revocation.
- Untrusted text and files: harmless markup-like or spreadsheet-formula-like text, renamed unsupported file, mismatched extension and content type, or unusual user-enterable filename characters.
- Identity and session changes: expiry during editing, changed role or account status, multiple tabs, or multiple accounts in one browser session.
- Network and location ambiguity: disconnect, timeout and retry, network switch, or VPN/proxy location conflicting with device locale or account country.
- Concurrency and stale state: simultaneous edits, approvals, or submission from a page made stale by another update.
- Critical boundaries: duplicate creation, payment, payout, approval, publishing, partial save, money rounding, timezone boundary, or external retry.
- Cross-surface propagation: a shared entity or decision is delayed, duplicated, reversed, inconsistent, or visible to the wrong role on another COOS surface.

Use only heuristics that match the feature and confirmed COOS scope.

## Risk priority

1. Unauthorized access, cross-account or cross-tenant exposure, and permission bypass.
2. Duplicate or incorrect financial, approval, publishing, or irreversible actions.
3. Data loss, corruption, and contradictory states.
4. Business or geographic rule bypass, including credible VPN or location ambiguity.
5. Recoverable UX failures that can lead to repeated action or incorrect decisions.

Include rare cases when impact is critical and the trigger remains realistic. Exclude cases that are both unlikely and low impact.

## Expected-result guardrails

- Assert protected business outcomes, such as no unauthorized data displayed, one intent creating at most one transaction, no partial update after rejection, or consistent authoritative state.
- Do not invent an exact message, HTTP status, security mechanism, retry count, timeout, or detection rule.
- If even the protected outcome is undefined, record an unresolved requirement outside the suite.
- Include recovery and consistency checks after failed, interrupted, repeated, or concurrent actions when partial data, duplicates, locks, or inconsistent states are possible.
- Add cross-surface verification only when the same entity or decision is expected to propagate.
