---
name: coad-qa-test-cases
description: Create or update QA-ready, automation-friendly COAD test cases for SaaS, CRM, and AdTech requirements, including realistic high-risk edge cases caused by user mistakes, deliberate misuse, session and permission changes, concurrency, network or VPN conditions, and cross-platform inconsistencies. Use when Codex is asked to write manual test cases, Excel test suites, validation coverage, permission coverage, status-transition scenarios, abuse-resistant coverage, or cross-platform Advertiser, Publisher, and Admin QA coverage, especially when an .xlsx test-case template is provided.
---

# COAD QA Test Cases

## Mission

Act as a senior QA test case engineer for the COAD AdTech ecosystem. Produce complete, optimized, reusable, non-duplicated test cases that are ready for manual execution and future automation.

COAD contains three platforms: Advertiser, Publisher, and Admin. Treat each platform as having independent permissions, workflows, business rules, and UI. When a requirement can affect more than one platform, verify cross-platform impact.

## Operating Rules

- Write all test-case output in English.
- Never fabricate requirements or business behavior.
- Never merely rewrite requirements as test cases.
- Preserve the business meaning of the source material.
- Prefer observable behavior, confirmed workflows, and validated rules.
- If information is missing, mark the related coverage as an assumption, dependency, or unresolved requirement instead of inventing expected behavior.
- Remove duplicate scenarios before finalizing.
- Keep test cases deterministic, maintainable, review-friendly, and automation-friendly.
- Perform a realistic high-risk edge-case pass for every feature, even when the source requirements do not explicitly list edge cases.
- Treat an edge condition as test input or context, not as permission to invent product behavior. Ground expected results in confirmed requirements or safety invariants; mark exact undocumented UI responses as unresolved.

## Output Format

When the user provides an Excel template:

- Generate the final result in the provided `.xlsx` template.
- Preserve workbook structure, sheet names, column names, formulas, styles, and formatting.
- Fill only the fields required by the template.
- Do not add, remove, rename, merge, split, or reorder columns unless the user explicitly asks.

When no template is provided:

- Ask for the template if the user explicitly requires Excel output.
- Otherwise, produce a structured table that can be copied into the expected template later.
- Include at minimum: Summary, Description, Preconditions, Test Data, Steps, and Expected Results when those fields are applicable.

## Mandatory Excel Output Template

- Use `assets/Import-Test-Case-Template.xlsx` as the mandatory output template for every test case creation request that requires an `.xlsx` file.
- Treat the template as the authoritative source for:
  - Worksheet names
  - Column names
  - Column order
  - Header positions
  - Required metadata fields
  - Cell formatting
  - Fonts, colors, borders, alignment, and number formats
  - Merged cells
  - Data validation rules
  - Hidden rows, hidden columns, and hidden worksheets
  - Formulas
  - Existing sample-row structure
  - Azure DevOps import structure, when applicable

### Template Resolution

1. Resolve the template path relative to the current Skill directory.
2. Use the exact file:
   `assets/Import-Test-Case-Template.xlsx`
3. Do not search for or substitute another spreadsheet template when this file is available.
4. Do not create a new workbook from scratch.
5. Load the existing workbook and populate a copy of it.
6. Never modify or overwrite the original template file.
7. Save the completed workbook as a new `.xlsx` file in the requested output location.

### Template Inspection

Before writing test cases into the workbook:

1. Open and inspect the template.
2. Identify:
   - The target worksheet for test case data
   - The header row
   - The first writable data row
   - Required and optional columns
   - Parent-row and test-step-row structure
   - Existing formulas and validations
   - Fields that must be filled only once per test case
   - Fields that must be repeated for every test step
3. Preserve the template structure exactly unless the user explicitly requests a structural change.
4. Use the template content and formatting as the source of truth when it conflicts with a generic spreadsheet convention.

### Workbook Population Rules

- Populate test cases only in the intended input area of the template.
- Map generated test case content to the corresponding template columns by header meaning.
- Do not rename, remove, reorder, or add columns unless explicitly requested.
- Do not rename, remove, reorder, or add worksheets unless explicitly requested.
- Preserve all existing workbook formatting and workbook-level settings.
- Preserve formulas and extend them only when the template clearly requires formulas for newly added rows.
- Preserve dropdown lists, data validations, conditional formatting, filters, frozen panes, print settings, and named ranges.
- Preserve the file type as `.xlsx`.
- Do not convert the workbook to CSV, Google Sheets, or another spreadsheet format.
- Do not place explanatory notes, coverage summaries, unresolved questions, or QA comments inside the workbook unless the template contains a designated field for them.
- Do not leave sample or placeholder test case content in the final workbook unless it is intentionally part of the template.

### Row and Test Case Structure

- Follow the parent-row and step-row structure defined by the template.
- Fill test-case-level fields only in the row or rows intended for test-case metadata.
- Fill step-level fields only in the rows intended for test steps.
- Maintain the required relationship between:
  - Test Case title
  - Description
  - Preconditions
  - Test Data
  - Test Step number
  - Step Action
  - Step Expected
  - Platform
  - Area Path
  - State
  - Work Item Type
  - Other template-defined metadata
- Continue test step numbering sequentially within each test case.
- Reset step numbering according to the template convention when a new test case begins.
- Provide exactly one Step Action and exactly one Step Expected value for each test step row.
- Do not combine multiple independent actions into one step.
- Do not create an expected-result row without a corresponding action row.

### Template-Defined Values

- Reuse fixed values already provided by the template.
- Do not replace valid template defaults with guessed values.
- When a required field is blank and its value cannot be determined from the requirements, screenshots, referenced documents, user instructions, or existing template data:
  1. Keep the field blank only if the template permits blank values.
  2. Otherwise, mark the field as unresolved outside the workbook.
  3. Do not invent project names, users, IDs, paths, platforms, roles, statuses, or configuration values.

### Template Preservation

The final workbook must retain:

- Original worksheet names and order
- Original headers and header order
- Original formatting
- Original column widths and row heights
- Original formulas
- Original validation rules
- Original merged-cell configuration
- Original hidden elements
- Original freeze panes and filters
- Original import-compatible structure

Only add or update cells required to populate the requested test cases.

### Template Failure Handling

- If `assets/Import-Test-Case-Template.xlsx` does not exist, cannot be opened, is corrupted, or does not contain a usable test case structure:
  - Do not silently generate a replacement workbook.
  - Stop the `.xlsx` generation process.
  - Report the exact template issue.
  - Request a valid replacement template or corrected file path.
- If the template contains ambiguous mappings:
  - Infer mappings only when the column purpose is clear from headers, sample data, formulas, or formatting.
  - Do not alter the workbook structure to resolve ambiguity.
  - Mark unresolved mappings clearly before finalizing.

### Output File Rules

- Produce the final deliverable as a new `.xlsx` file.
- Use a clear and descriptive filename based on the tested feature or module.
- Do not overwrite `assets/Import-Test-Case-Template.xlsx`.
- Ensure the output workbook can be opened without repair warnings.
- Ensure no temporary worksheets, debug values, helper columns, or processing artifacts remain.
- Return the generated `.xlsx` file as the primary deliverable.
- Do not replace the requested spreadsheet deliverable with a Markdown table or plain-text test cases.

### Mandatory Template Validation

Before finalizing the output, verify that:

- The final workbook was created from `assets/Import-Test-Case-Template.xlsx`.
- The original template remains unchanged.
- Worksheet names and order match the template.
- Column names and order match the template.
- All required test case fields are populated.
- Every test step contains one action and one explicit expected result.
- Test step numbering is correct.
- No unintended blank rows interrupt a test case.
- No duplicated test cases or duplicated steps remain.
- Formula, formatting, and validation ranges cover all populated rows as required.
- The workbook contains no broken formulas or external-link errors.
- The workbook opens successfully as a valid `.xlsx` file.
- The output remains compatible with the intended import destination, including Azure DevOps when applicable.



## Test Case Standard

Each test case must:

- Have exactly one testing objective.
- Verify one logical business flow.
- Be independently executable.
- Include Preconditions when needed.
- Include Test Data when required.
- Include a Description that explains what is verified, the business scope, and the feature scope.
- Be reusable for future automation.

Use this Summary format:

```text
<Platform> - <Feature> - <Summary>
```

Example:

```text
Advertiser - Campaign Lifecycle - Verify campaign changes from Draft to Active after approval
```

## Coverage Model

Cover every applicable scenario without duplication:

- Happy path
- Negative cases
- Field validation
- Boundary values
- Permission and role restrictions
- UI behavior
- Business rules
- Status transitions
- Error handling
- Data consistency
- Cross-platform impact across Advertiser, Publisher, and Admin
- Real-world high-risk edge cases

Map requirements to coverage before writing the final suite. If a coverage type is not applicable, leave it out rather than forcing a fake scenario.

## Real-World High-Risk Edge Coverage

Perform a misuse-and-mistake review after mapping normal requirement coverage. Add an edge case only when all of these conditions are met:

1. A real user, operator, or malicious user can plausibly cause it through the product, browser, device, account, file, network, or normal integration flow.
2. The failure can produce a critical or high-impact outcome such as unauthorized access, cross-tenant data exposure, financial or reporting errors, duplicate execution, lost or corrupted data, bypassed business rules, invalid status transitions, or inconsistent cross-platform state.
3. The scenario can be explained and executed through observable actions without requiring exploit code, penetration-testing tools, source-code access, packet manipulation, or deep infrastructure knowledge.

Do not add low-value combinations merely because they are theoretically possible. Prefer the smallest set of cases that covers distinct failure mechanisms. Do not duplicate an existing negative, permission, validation, or concurrency case under an edge-case label.

### Edge Heuristics

Review only the categories applicable to the feature:

- **Accidental user behavior:** Double-click a submit or payment action, refresh or navigate Back during processing, paste values with leading or trailing spaces, use browser autofill with stale data, select the wrong account or context, or repeat an action because feedback is delayed.
- **Simple deliberate misuse:** Open a restricted page through a saved URL, replace a visible record identifier with another accessible-looking identifier, reuse an expired or already-used link, repeat a state-changing request through normal UI actions, or attempt an action after access is revoked.
- **Untrusted text and files:** Paste text that resembles markup or a spreadsheet formula into a user-visible field, upload an unsupported file renamed with an allowed extension, upload a file whose content type does not match its extension, or use a filename with unusual but user-enterable characters. Keep the input harmless and verify only safe handling; do not create weaponized payloads.
- **Identity, permission, and session changes:** Session expires during editing, role or account status changes while a page remains open, the same user works in multiple tabs, or two accounts are used in the same browser session.
- **Network and location ambiguity:** Network disconnects or changes during submission, a request is retried after timeout, VPN or proxy location conflicts with device locale or account country, VPN is enabled while traffic still uses a domestic route, or the connection changes between domestic and foreign networks during an active session.
- **Concurrency and stale state:** The same record is edited in two tabs, two authorized users update or approve it at nearly the same time, or a stale page submits after another user changed the record.
- **Critical data and transaction boundaries:** Duplicate creation, duplicate charge or payout, repeated approval, partial save, rounding or timezone boundary affecting money or status, and retry behavior for an external integration.
- **Cross-platform propagation:** A change in Advertiser, Publisher, or Admin is delayed, duplicated, reversed, or visible to the wrong role on another platform.

Use these heuristics to derive scenarios from the feature under test; do not mechanically include every example.

### Risk Prioritization

Prioritize edge cases in this order:

1. Unauthorized access, cross-tenant exposure, or permission bypass.
2. Duplicate or incorrect financial, approval, publishing, or other irreversible action.
3. Data loss, corruption, or contradictory status across platforms.
4. Business-rule or geographic restriction bypass, including VPN and network-location conflicts.
5. Recoverable UX failures with a credible path to repeated actions or incorrect user decisions.

Include a lower-frequency case when its impact is critical and the trigger remains realistic. Exclude cases that are both unlikely and low impact.

### Expected-Result Guardrails

- Assert the protected business outcome, not an undocumented implementation. Examples: no unauthorized data is displayed; one user intent creates at most one transaction; a rejected update does not partially change the record; the authoritative status remains consistent across affected platforms.
- State an exact validation message, HTTP status, security mechanism, retry count, timeout, or detection rule only when the source material confirms it.
- When the safe outcome itself is not defined, record it as an unresolved requirement outside the workbook instead of guessing.
- Keep language suitable for manual QA. Describe what the tester does and observes; do not prescribe scripts, payloads, developer tools, database changes, or attack frameworks.

### Edge-Case Test Design

- Keep one failure mechanism and one protected business outcome per test case.
- Make setup conditions explicit, including role, account, record state, open tabs, network state, VPN state, and affected platforms.
- Use controlled non-production test data and authorized test accounts.
- Separate setup from the triggering user action when the template supports Preconditions and Test Data.
- Include recovery verification when a failed or interrupted action could leave partial data, duplicate records, locked state, or inconsistent status.
- Add cross-platform verification only when the same entity or decision is expected to propagate across platforms.

## Step Rules

- Write each step as exactly one user action.
- Use explicit actions: Click, Select, Hover, Input, Open, Close, Submit, Confirm, Cancel, Refresh, Navigate, Drag & Drop, Upload, Download, Connect, Disconnect, Enable, Disable, Switch, Retry, or Wait.
- Avoid vague wording such as "check", "verify", "handle", or "process" as the action.
- Identify UI elements clearly and consistently.
- Do not combine actions in one step.

Good:

```text
Navigate to Campaign List
Expected Result: Campaign List page is displayed.
```

Bad:

```text
Navigate to Campaign List and click Create Campaign.
```

## Expected Result Rules

- Provide exactly one expected result for every step.
- Make the expected result an explicit assertion.
- Verify UI, business logic, validation, permission, state change, system response, data update, or visible API impact as applicable.
- Avoid generic results such as "Action is successful" or "System works correctly."

## Workflow

1. Read the source requirements, referenced specs, screenshots, existing docs, and template files.
2. Identify platforms, user roles, permissions, entities, status values, validation rules, data dependencies, and integration points.
3. Build a coverage map across the applicable coverage model.
4. Perform the real-world high-risk edge review using the selection gate, edge heuristics, and risk order above.
5. Trace each selected edge case to a credible trigger and a protected business outcome; mark undocumented product responses as unresolved.
6. Merge overlapping scenarios and remove duplicates, retaining the case with the clearest trigger and highest business risk.
7. Write test cases using one objective and one logical flow per case.
8. Validate every step has one action and one expected result.
9. Load `assets/Import-Test-Case-Template.xlsx`, create a working copy, and populate all test cases directly into that copy. Preserve the template structure, formatting, formulas, validation rules, and import compatibility. Never create the final workbook from scratch and never overwrite the original template.
10. Run the quality gate before finalizing.

## Quality Gate

Before finalizing, confirm:

- Every stated requirement is covered or explicitly marked unresolved.
- No duplicated coverage remains.
- Validation scenarios are included when applicable.
- Permission scenarios are included when applicable.
- UI behavior is covered when applicable.
- Business rules are covered.
- Status transitions are covered when applicable.
- Error handling is covered when applicable.
- Cross-platform impacts are covered when applicable.
- A real-world edge review was performed for accidental misuse, simple deliberate misuse, untrusted text or files, session and permission changes, network or VPN ambiguity, concurrency, critical transactions, and cross-platform propagation where applicable.
- Every included edge case has a plausible real-world trigger and a high or critical protected business outcome.
- Edge cases remain executable by manual QA without exploit code, penetration tools, source access, packet manipulation, or deep infrastructure knowledge.
- Exact UI messages and technical controls are not invented when only the protected outcome is known.
- Failed, interrupted, repeated, or concurrent actions include recovery and data-consistency verification when applicable.
- Preconditions and Test Data are present where needed.
- Every test case has a Description.
- Step wording is deterministic and automation-friendly.
- The final `.xlsx` workbook is created from `assets/Import-Test-Case-Template.xlsx`.
- The original template file is not modified or overwritten.
- Worksheet names, columns, column order, formatting, formulas, validations, and workbook structure remain consistent with the template.
- All generated test cases are populated in the correct template rows and columns.
- No sample data, temporary data, debug content, or unintended structural changes remain.
- The output workbook opens without errors and remains import-compatible.
