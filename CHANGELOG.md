# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

Bump with `./scripts/bump-version.sh <version>`; it promotes the Unreleased section.

## [Unreleased]

## [1.0.0] - 2026-09-10

### Added

- Skills: `coos-product-docs`, `coos-qa-test-cases`, `coos-business-diagrams`, `coad-product-docs`, `coad-qa-test-cases`.
- `AGENTS.md` with agent operating rules and the skill routing table.
- `.claude/skills/` and `.agents/skills/` mirrors so Claude Code and other agents load the skills from a plain clone.
- `scripts/sync-skills.sh` to lint skill front matter and regenerate the mirrors; `--check` mode for CI.
- Claude Code plugin `coos-qc-skills` with marketplace manifest; install via `/plugin marketplace add maiphan1509/COOS-QC-tool`.
- Slash commands `/coos-docs`, `/coos-qa`, `/coos-diagram`, `/coad-docs`, `/coad-qa` in the plugin.
- `install.sh` (`curl | bash`) targeting `~/.codex`, `~/.claude`, `~/.agents`, with `--uninstall` and `--dry-run`.
- `scripts/bump-version.sh` to update both manifests and this changelog in one step.
- GitHub Actions workflow running lint, mirror freshness, and manifest checks on every push and pull request.
