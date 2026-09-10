# AGENTS.md

Instructions for any coding agent (Codex, Claude Code, Cursor, Copilot, Gemini CLI) working in this repository.

## What this repository is

A skill pack for COOS and COAD product/QA work. It ships no application code. The deliverable is the skill set in `.codex/skills/`, mirrored to other agent runtimes and packaged for install.

## Skill inventory

| Skill | Use it for |
| --- | --- |
| `coos-product-docs` | COOS requirements, acceptance criteria, UI behavior specs, discovery notes, reference-spec updates |
| `coos-qa-test-cases` | COOS manual test cases and Excel suites with traceability, permission and lifecycle coverage |
| `coos-business-diagrams` | COOS business-process Mermaid diagrams for non-technical and delivery stakeholders |
| `coad-product-docs` | COAD (Advertiser / Publisher / Admin) PO and BA documentation |
| `coad-qa-test-cases` | COAD test cases across the three platforms, including abuse and edge-case coverage |

Each skill lives in `<skills-root>/<skill-name>/` with:

- `SKILL.md` — the instructions. Always read this in full before producing output.
- `references/` — supporting rules the SKILL.md links to. Read a reference when SKILL.md tells you to.
- `assets/` — templates (for example `Import-Test-Case-Template.xlsx`). Fill the template; do not invent a new format.
- `agents/openai.yaml` — Codex interface metadata (display name, default prompt). Not instructions.

## When to invoke a skill

Invoke a skill before you write anything, not after a draft exists.

- Any request to write, update, or review COOS product documentation → `coos-product-docs`
- Any request for COOS test cases, QA coverage, or an Excel test suite → `coos-qa-test-cases`
- Any request for a COOS flow, process, journey, or lifecycle diagram → `coos-business-diagrams`
- The same three intents scoped to COAD → the `coad-*` equivalents

COOS and COAD are separate products. Never carry roles, platforms, terminology, or business rules from one into the other, and never carry them in from another project.

If the product is ambiguous, ask which one before starting.

## How to invoke, per runtime

- **Codex** — skills resolve from `.codex/skills/`. Reference one as `$coos-qa-test-cases`.
- **Claude Code** — skills resolve from `.claude/skills/`. Use the `Skill` tool, or install the plugin (see [README.md](README.md)).
- **Other agents** — read `.agents/skills/<name>/SKILL.md` directly and follow it as a system instruction.

All three trees hold identical content. See "Skill sources" below.

## Skill sources

`.codex/skills/` is the single source of truth. `.claude/skills/`, `.agents/skills/`, and `plugins/coos-qc-skills/skills/` are generated mirrors and are committed so the repo works without a build step.

Never edit a mirror. Edit `.codex/skills/`, then run:

```bash
./scripts/sync-skills.sh
```

Verify mirrors are current without writing (used by CI):

```bash
./scripts/sync-skills.sh --check
```

If you change a skill and skip the sync, Claude Code and plugin users silently get the old version.

## Adding a skill

1. Create `.codex/skills/<kebab-name>/SKILL.md` with YAML front matter holding `name` and `description`.
   - `name` must equal the directory name.
   - `description` must state both what the skill does and when to use it — it is the only text an agent sees when deciding whether to load the skill.
2. Put supporting rules in `references/`, templates in `assets/`.
3. Add `agents/openai.yaml` with `interface.display_name`, `interface.short_description`, `interface.default_prompt`.
4. Run `./scripts/sync-skills.sh`.
5. Add a row to the Skill inventory table above.

## Output conventions

- Skill output is written in English unless the requester explicitly asks otherwise.
- Never fabricate requirements, business rules, or behavior. Surface gaps as explicit assumptions or open questions.
- When updating a reference document, preserve its hierarchy, numbering, section order, and formatting.

## Repository conventions

- Do not commit `.DS_Store` or other OS metadata.
- Keep skill content free of customer-identifying data and credentials.
- `scripts/` and `install.sh` are POSIX shell, run under `bash`, and must stay executable (`chmod +x`).
