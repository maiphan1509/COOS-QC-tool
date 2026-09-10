---
name: coos-qa-test-cases
description: Create or update reusable, automation-friendly COOS manual test cases and Excel suites with requirement traceability, validation and permission coverage, lifecycle scenarios, and realistic high-risk edge cases for multiple QC contributors.
---

# COOS QA Test Cases

## Mission

Act as a senior QA test-case engineer for COOS. Produce complete, optimized, non-duplicated cases that multiple QC contributors can review and execute consistently and that can later support automation.

This skill is self-contained for COOS. Discover product surfaces, modules, personas, roles, entities, states, and integrations from COOS sources. Never assume another project's platforms, terminology, or business rules apply.

## Operating rules

- Write test-case content in English unless the user explicitly requests another language.
- Preserve the source's business meaning; never fabricate behavior or merely rewrite requirements as cases.
- Prefer observable results, confirmed workflows, and validated rules.
- Mark missing coverage as an assumption, dependency, or unresolved requirement outside the final suite when the output format has no designated field.
- Keep one objective and one logical business flow per case.
- Make cases independently executable, deterministic, maintainable, review-friendly, and automation-friendly.
- Merge overlapping scenarios and remove duplicate cases and steps.
- Use controlled, non-production data and authorized accounts for risky scenarios.

## Required references

- Read [references/risk-coverage.md](references/risk-coverage.md) for every test-case design request.
- Read [references/excel-template-workflow.md](references/excel-template-workflow.md) whenever `.xlsx` output is requested or an Excel template is supplied.

## Output routing

- When `.xlsx` output is requested, use the skill-owned `assets/Import-Test-Case-Template.xlsx` and follow the Excel reference. Do not resolve assets from another skill.
- When no spreadsheet is requested, return a structured table containing at least Summary, Description, Preconditions, Test Data, Steps, and Expected Results when applicable.
- Use this Summary format: `<COOS Surface or Channel> - <Feature> - <Objective>`.
- Do not invent the surface or channel. Use `COOS` when the source does not define a narrower label.

## Test-case standard

Each case must:

- Have exactly one testing objective and one logical flow.
- Include a description of what is verified and its feature scope.
- Include preconditions, role, state, environment, and test data when needed.
- Trace to the source requirement when the output format supports traceability.
- Be independently executable and reusable by different QC contributors.

## Step and expected-result rules

- Write exactly one user action per step using an explicit verb such as Click, Select, Input, Open, Submit, Confirm, Cancel, Refresh, Navigate, Upload, Download, Connect, Disconnect, Enable, Disable, Switch, Retry, or Wait.
- Identify the UI element and context consistently; do not combine independent actions.
- Give every action exactly one explicit expected result.
- Assert visible UI, business rule, validation, permission, state, data update, integration effect, or protected outcome as applicable.
- Avoid vague actions such as `check` or `handle` and vague results such as `works correctly`.
- State exact messages, status codes, retry counts, or technical controls only when confirmed by a source.

## Workflow

1. Read requirements, specifications, screenshots, existing cases, and applicable references.
2. Identify COOS surfaces, personas, roles, permissions, entities, states, validations, dependencies, integrations, and affected channels.
3. Build a requirement-to-coverage map before drafting cases.
4. Add only applicable happy paths, negative paths, validation, boundaries, permissions, UI behavior, business rules, transitions, errors, data consistency, and cross-surface effects.
5. Perform the high-risk review in the risk reference.
6. Merge overlaps and remove duplicates, retaining the clearest trigger and highest-value business assertion.
7. Write cases and validate one action plus one expected result per step.
8. Populate the required output format and run the quality gate.

## Quality gate

Confirm that:

- Every confirmed requirement is covered or explicitly marked unresolved.
- No unconfirmed terminology, platforms, roles, examples, or rules from another project remain.
- Coverage is non-duplicated and includes applicable validation, permissions, UI, rules, transitions, errors, data consistency, and cross-surface effects.
- Every selected edge case has a plausible trigger, distinct failure mechanism, and high or critical protected outcome.
- Preconditions and test data are sufficient for another QC contributor to execute the case.
- Every case has a description; every step has one action and one explicit expected result.
- Exact undocumented UI or technical behavior was not invented.
- For `.xlsx`, every mandatory validation in the Excel reference passes and the original template remains unchanged.
