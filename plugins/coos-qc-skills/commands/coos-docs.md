---
description: Write or update COOS product documentation (requirements, acceptance criteria, UI behavior specs) with the coos-product-docs skill
argument-hint: <feature name, spec file path, or pasted requirements>
---

Load the `coos-product-docs` skill with the Skill tool before doing anything else. Inside this plugin it is listed as `coos-qc-skills:coos-product-docs`. Follow it exactly; do not draft from memory of the skill.

Request:

$ARGUMENTS

If the request names a file, read it in full first. If it names an existing reference document to update, treat that document as the source of truth and preserve its structure. If no input was given, ask for the feature scope and any reference specification before writing.
