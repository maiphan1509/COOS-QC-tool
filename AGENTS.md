# AGENTS.md

Instructions for any coding agent (Codex, Claude Code, Cursor, Copilot, Gemini CLI) working in this repository.

## What this repository is

A skill pack for COOS and COAD product/QA work. It ships no application code. The deliverable is the skill set in `.codex/skills/`, mirrored to other agent runtimes and packaged for install, plus the COOS platform reference under `platforms/` (see below).

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
- **Claude Code plugin** — also exposes slash commands that load the matching skill and pass the argument through: `/coos-docs`, `/coos-qa`, `/coos-diagram`, `/coad-docs`, `/coad-qa` (namespaced form: `/coos-qc-skills:coos-qa`). Sources live in `plugins/coos-qc-skills/commands/`.
- **Other agents** — read `.agents/skills/<name>/SKILL.md` directly and follow it as a system instruction.

All three skill trees hold identical content. See "Skill sources" below.

## Skill sources

`.codex/skills/` is the single source of truth. `.claude/skills/`, `.agents/skills/`, and `plugins/coos-qc-skills/skills/` are generated mirrors and are committed so the repo works without a build step.

Never edit a mirror. Edit `.codex/skills/`, then run:

```bash
./scripts/sync-skills.sh
```

The script lints every skill first (front matter present, `name` equals the directory name, `description` non-empty and under 1024 characters, `agents/openai.yaml` present) and refuses to mirror on any failure.

Verify without writing — this is what CI runs on every push and pull request:

```bash
./scripts/sync-skills.sh --check
```

If you change a skill and skip the sync, Claude Code and plugin users silently get the old version. CI (`.github/workflows/check.yml`) fails the pull request in that case.

## Adding a skill

1. Create `.codex/skills/<kebab-name>/SKILL.md` with YAML front matter holding `name` and `description`.
   - `name` must equal the directory name.
   - `description` must state both what the skill does and when to use it — it is the only text an agent sees when deciding whether to load the skill.
2. Put supporting rules in `references/`, templates in `assets/`.
3. Add `agents/openai.yaml` with `interface.display_name`, `interface.short_description`, `interface.default_prompt`.
4. Run `./scripts/sync-skills.sh`; fix anything the lint reports.
5. Add a row to the Skill inventory table above and an entry under `## [Unreleased]` in `CHANGELOG.md`.
6. Optional: add a slash command in `plugins/coos-qc-skills/commands/<short-name>.md` following the existing files (front matter with `description` and `argument-hint`, body loads the skill and passes `$ARGUMENTS`).

## Releasing

Plugin users only receive changes when the version rises. Bump every manifest and promote the changelog in one step:

```bash
./scripts/bump-version.sh 1.1.0
```

Add `--tag` to also commit and create `v1.1.0`, then `git push --follow-tags`. Never edit the `version` fields by hand; they must agree across `plugin.json` and `marketplace.json`, and CI checks that they do.

## COOS platform reference (`platforms/`)

`platforms/` is the observed-behavior knowledge base for the three COOS portals. Read it before producing any COOS deliverable so screens, routes, statuses, and timing rules come from the product instead of from memory.

| Path | Use it for |
| --- | --- |
| [`platforms/AGENTS.md`](platforms/AGENTS.md) | Platform map (Buyer `mynew1.net`, Seller `seller.mynew1.net`, Admin `admin.mynew1.net`), shared foundations (auth, locales, notifications, audit, files, payments), glossary, status catalog, platform configuration values, route inventory (260 routes), known staging defects |
| [`platforms/buyer/AGENTS.md`](platforms/buyer/AGENTS.md) | Buyer Portal screens (home, categories, fab detail, checkout, orders, order detail, account, auth) and all 67 `buyer.*` routes |
| [`platforms/seller/AGENTS.md`](platforms/seller/AGENTS.md) | Seller Portal sidebar, datatables, forms (profile, artifact submit, revision accept/deny), detail views, and all 67 `seller.*` routes |
| [`platforms/admin/AGENTS.md`](platforms/admin/AGENTS.md) | Admin Portal IAM, Fabricas, Finance, Operation, Configuration, Governance modules and all 122 `admin.*` routes |
| [`platforms/workflows/`](platforms/workflows/AGENTS.md) | Four Mermaid `.mmd` lifecycle diagrams (order overview, seller queue, artifact delivery, revision and dispute) with a node-to-route mapping and the configuration keys behind each timing rule |

Rules for using and maintaining it:

- Skill routing stays the same: `coos-product-docs`, `coos-qa-test-cases`, and `coos-business-diagrams` decide *how* to write; `platforms/` supplies *what* the product does. Cite the portal file and route name (for example `buyer.account.orders.show`) in acceptance criteria and test steps.
- Lines starting with `Unresolved requirement:` mark behavior that was not observable on 2026-09-10. Carry them into deliverables as open questions; never resolve them by assumption.
- The reference is a staging snapshot. When a task depends on a route or value, re-check it on the environment before asserting it, and update the file with the new date.
- Never add personal data, credentials, CSRF tokens, or presigned URLs. Seller display names of test accounts are the only identifiers allowed.
- Diagram files in `platforms/workflows/` are the source of truth for lifecycle rules; if staging contradicts a diagram, record the contradiction in the portal file instead of editing the diagram.

## Output conventions

- Skill output is written in English unless the requester explicitly asks otherwise.
- Never fabricate requirements, business rules, or behavior. Surface gaps as explicit assumptions or open questions.
- When updating a reference document, preserve its hierarchy, numbering, section order, and formatting.

## Repository conventions

- Do not commit `.DS_Store` or other OS metadata.
- Keep skill content free of customer-identifying data and credentials.
- `scripts/` and `install.sh` are POSIX shell, run under `bash`, and must stay executable (`chmod +x`).
