# COOS-QC-tool

Agent skill pack for COOS and COAD product and QA work.

| Skill | Purpose |
| --- | --- |
| `coos-product-docs` | COOS requirements, acceptance criteria, UI behavior specs, reference-spec updates |
| `coos-qa-test-cases` | COOS manual test cases and Excel suites with traceability and risk coverage |
| `coos-business-diagrams` | COOS business-process Mermaid diagrams |
| `coad-product-docs` | COAD Advertiser / Publisher / Admin PO and BA documentation |
| `coad-qa-test-cases` | COAD cross-platform test cases including abuse and edge cases |

Agent behavior rules live in [AGENTS.md](AGENTS.md).

## Install

### Claude Code plugin (recommended)

```bash
/plugin marketplace add maiphan1509/COOS-QC-tool
```

```bash
/plugin install coos-qc-skills@coos-qc-tool
```

Updates arrive with `/plugin marketplace update coos-qc-tool`.

### Installer script

Installs into `~/.codex/skills`, `~/.claude/skills`, and `~/.agents/skills`:

```bash
curl -fsSL https://raw.githubusercontent.com/maiphan1509/COOS-QC-tool/main/install.sh | bash
```

Pick one runtime, preview, or remove:

```bash
./install.sh --claude
```

```bash
./install.sh --dry-run
```

```bash
./install.sh --uninstall
```

### Clone only

Clone the repo and open it as your working directory. Codex reads `.codex/skills/`, Claude Code reads `.claude/skills/`, other agents read `.agents/skills/`. No install step.

## Use

- **Codex** — `Use $coos-qa-test-cases to build a QA suite from these requirements.`
- **Claude Code** — invoke via the `Skill` tool, or just describe the task; the skill descriptions route it.
- **Claude Code plugin** — slash commands that load the skill and pass your input through:

  | Command | Skill |
  | --- | --- |
  | `/coos-docs <feature or spec>` | `coos-product-docs` |
  | `/coos-qa <requirements> [template.xlsx]` | `coos-qa-test-cases` |
  | `/coos-diagram <process>` | `coos-business-diagrams` |
  | `/coad-docs <feature or spec>` | `coad-product-docs` |
  | `/coad-qa <requirements> [template.xlsx]` | `coad-qa-test-cases` |

  If another plugin defines the same short name, use the namespaced form, e.g. `/coos-qc-skills:coos-qa`.
- **Other agents** — point the agent at `.agents/skills/<name>/SKILL.md`.

## Develop

`.codex/skills/` is the source of truth. `.claude/skills/`, `.agents/skills/`, and `plugins/coos-qc-skills/skills/` are committed mirrors.

After editing a skill (lints front matter, then rewrites the mirrors):

```bash
./scripts/sync-skills.sh
```

Confirm mirrors are current (CI-friendly, writes nothing):

```bash
./scripts/sync-skills.sh --check
```

CI runs that check plus ShellCheck and manifest validation on every push and pull request.

Release a new version (updates `plugin.json`, `marketplace.json`, and `CHANGELOG.md` together; add `--tag` to commit and tag):

```bash
./scripts/bump-version.sh 1.1.0
```

Adding a new skill is described in [AGENTS.md](AGENTS.md#adding-a-skill).
