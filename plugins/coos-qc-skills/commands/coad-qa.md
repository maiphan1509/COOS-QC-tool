---
description: Build a COAD cross-platform test suite (Advertiser, Publisher, Admin) with the coad-qa-test-cases skill
argument-hint: <requirements or spec file, optional .xlsx template path>
---

Load the `coad-qa-test-cases` skill with the Skill tool before doing anything else. Inside this plugin it is listed as `coos-qc-skills:coad-qa-test-cases`. Follow it exactly, including cross-platform impact checks and the Excel template when one is involved.

Request:

$ARGUMENTS

If the request names a requirements file, read it in full first. If an `.xlsx` template is provided or the skill's bundled template applies, fill that template rather than inventing a layout. If no input was given, ask for the requirements, the platforms in scope, and the target output format before writing.
