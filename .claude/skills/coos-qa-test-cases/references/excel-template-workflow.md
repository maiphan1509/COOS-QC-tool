# COOS Excel Test Suite Workflow

Read this reference whenever `.xlsx` output is requested or an Excel template is supplied.

## Template authority

Use `assets/Import-Test-Case-Template.xlsx` relative to the skill root. It is the authoritative COOS template for worksheet names, order, headers, column order, metadata, formulas, styles, validations, hidden elements, merged cells, freezes, filters, print settings, sample-row structure, and import compatibility.

Never modify or overwrite the asset. Load it and save a populated copy as a clearly named new `.xlsx` file. Do not create the requested workbook from scratch or convert it to another format.

If the asset is missing, corrupted, cannot be opened, or lacks a usable test-case structure, stop spreadsheet generation and report the exact problem. Do not silently substitute another workbook.

## Inspect before writing

Identify the target sheet, header row, first writable row, required and optional columns, parent-row and step-row structure, formulas, validations, sample data, fixed defaults, and which fields repeat per step. When generic conventions conflict with the workbook, the workbook wins.

## Populate a copy

- Write only in the intended input area and map fields by header meaning.
- Preserve sheets, headers, columns, order, widths, heights, styles, number formats, formulas, validation, conditional formatting, merged cells, named ranges, hidden elements, frozen panes, filters, print settings, and workbook-level settings.
- Extend formulas, formatting, and validation only where the template clearly requires coverage for new rows.
- Follow the template's parent-row and step-row conventions.
- Populate test-case metadata only in intended rows and step data only in step rows.
- Number steps sequentially within each case and reset numbering according to the template convention.
- Give each step row exactly one action and one expected result.
- Reuse fixed template values. Never guess project names, paths, users, IDs, roles, surfaces, statuses, or configuration.
- Leave a required unknown blank only when the template permits it; otherwise report the unresolved mapping outside the workbook.
- Remove placeholder or sample cases unless they are intentionally part of the template.
- Do not add explanatory notes, coverage summaries, or QA comments unless a designated field exists.

## Mandatory validation

Before delivery, confirm:

- The final workbook was created from the skill-owned template and the original template checksum is unchanged.
- Worksheet names/order and column names/order match the template.
- All determinable required fields are populated and unresolved mandatory mappings are reported.
- Parent and step rows follow the template convention with correct numbering and no unintended blank interruptions.
- Every step contains one action and one explicit expected result.
- No duplicate cases, duplicate steps, sample data, temporary sheets, helper columns, or debug artifacts remain.
- Formula, formatting, conditional-formatting, and validation ranges cover populated rows as required.
- There are no broken formulas or external-link errors.
- The file opens without repair warnings and remains compatible with its intended import destination, including Azure DevOps when applicable.
