---
description: Write or update COAD (Advertiser, Publisher, Admin) product documentation with the coad-product-docs skill
argument-hint: <feature name, spec file path, or pasted requirements>
---

Load the `coad-product-docs` skill with the Skill tool before doing anything else. Inside this plugin it is listed as `coos-qc-skills:coad-product-docs`. Follow it exactly; COAD is a separate product from COOS, so do not reuse COOS roles, platforms, or terminology.

Request:

$ARGUMENTS

If the request names a file, read it in full first. If it names an existing reference document to update, treat that document as the source of truth and preserve its structure. If no input was given, ask which platform(s) are in scope and for any reference specification before writing.
