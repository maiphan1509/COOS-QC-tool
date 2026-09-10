---
description: Build a COOS manual test suite (QA-ready, automation-friendly, Excel template aware) with the coos-qa-test-cases skill
argument-hint: <requirements or spec file, optional .xlsx template path>
---

Load the `coos-qa-test-cases` skill with the Skill tool before doing anything else. Inside this plugin it is listed as `coos-qc-skills:coos-qa-test-cases`. Follow it exactly, including its references and the Excel template workflow when a template is involved.

Request:

$ARGUMENTS

If the request names a requirements file, read it in full first. If an `.xlsx` template is provided or the skill's bundled template applies, fill that template rather than inventing a layout. If no input was given, ask for the requirements and the target output format before writing.
