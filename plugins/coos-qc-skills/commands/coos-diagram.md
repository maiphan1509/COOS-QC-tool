---
description: Draw, redraw, or review a COOS business-process Mermaid diagram with the coos-business-diagrams skill
argument-hint: <process name, journey description, or existing diagram to revise>
---

Load the `coos-business-diagrams` skill with the Skill tool before doing anything else. Inside this plugin it is listed as `coos-qc-skills:coos-business-diagrams`. Read its `references/visual-language.md` as the skill instructs and apply that visual grammar.

Request:

$ARGUMENTS

If the request points at source material, read it in full first. If it includes an existing Mermaid diagram, revise that diagram instead of starting over. If no input was given, ask for the business scope, trigger, and outcome before drawing.
