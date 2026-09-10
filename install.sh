#!/usr/bin/env bash
#
# Install the COOS/COAD skill pack into your agent runtimes.
#
#   Local checkout:  ./install.sh
#   Remote:          curl -fsSL https://raw.githubusercontent.com/maiphan1509/COOS-QC-tool/main/install.sh | bash
#
# Options:
#   --codex        install to ~/.codex/skills only
#   --claude       install to ~/.claude/skills only
#   --agents       install to ~/.agents/skills only
#   --prefix DIR   install under DIR instead of $HOME
#   --uninstall    remove the skills this installer created
#   --dry-run      print what would happen, change nothing
#   -h, --help     show this help
#
# With no target flag, all three runtimes are installed.
set -euo pipefail

REPO_URL="https://github.com/maiphan1509/COOS-QC-tool.git"
RAW_SOURCE=".codex/skills"
SKILLS=(
  coos-product-docs
  coos-qa-test-cases
  coos-business-diagrams
  coad-product-docs
  coad-qa-test-cases
)

PREFIX="$HOME"
DRY_RUN=0
UNINSTALL=0
TARGETS=()
TMP_CLONE=""

# Reprint this file's header comment. Falls back to a one-liner when the script
# was piped in (curl | bash), where "$0" is the shell, not a readable file.
usage() {
  if [ -r "$0" ]; then
    sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  else
    echo "usage: install.sh [--codex|--claude|--agents] [--prefix DIR] [--uninstall] [--dry-run]"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --codex)     TARGETS+=(".codex/skills") ;;
    --claude)    TARGETS+=(".claude/skills") ;;
    --agents)    TARGETS+=(".agents/skills") ;;
    --prefix)    shift; PREFIX="${1:?--prefix needs a directory}" ;;
    --uninstall) UNINSTALL=1 ;;
    --dry-run)   DRY_RUN=1 ;;
    -h|--help)   usage; exit 0 ;;
    *)           echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(".codex/skills" ".claude/skills" ".agents/skills")
fi

say()  { printf '%s\n' "$*"; }
run()  { if [ "$DRY_RUN" -eq 1 ]; then say "  would: $*"; else "$@"; fi; }

cleanup() { [ -n "$TMP_CLONE" ] && rm -rf "$TMP_CLONE"; }
trap cleanup EXIT

# ---------------------------------------------------------------- uninstall

if [ "$UNINSTALL" -eq 1 ]; then
  say "Removing COOS/COAD skills under $PREFIX"
  removed=0
  for target in "${TARGETS[@]}"; do
    for skill in "${SKILLS[@]}"; do
      dir="$PREFIX/$target/$skill"
      if [ -d "$dir" ]; then
        say "  remove $dir"
        run rm -rf "$dir"
        removed=$((removed + 1))
      fi
    done
  done
  say "Removed $removed skill director$([ "$removed" -eq 1 ] && echo y || echo ies)."
  exit 0
fi

# ------------------------------------------------------------------ source

if [ -d "$RAW_SOURCE" ] && [ -f "$RAW_SOURCE/coos-product-docs/SKILL.md" ]; then
  SRC="$(cd "$RAW_SOURCE" && pwd)"
  say "Source: local checkout ($SRC)"
else
  command -v git >/dev/null 2>&1 || { echo "error: git is required to install remotely" >&2; exit 1; }
  TMP_CLONE="$(mktemp -d "${TMPDIR:-/tmp}/coos-qc-tool.XXXXXX")"
  say "Source: cloning $REPO_URL"
  git clone --quiet --depth 1 "$REPO_URL" "$TMP_CLONE"
  SRC="$TMP_CLONE/$RAW_SOURCE"
  [ -d "$SRC" ] || { echo "error: $RAW_SOURCE missing in clone" >&2; exit 1; }
fi

# ----------------------------------------------------------------- install

installed=0
for target in "${TARGETS[@]}"; do
  dest_root="$PREFIX/$target"
  say ""
  say "-> $dest_root"
  run mkdir -p "$dest_root"
  for skill in "${SKILLS[@]}"; do
    [ -d "$SRC/$skill" ] || { say "  skip $skill (not in source)"; continue; }
    dest="$dest_root/$skill"
    if [ -d "$dest" ]; then
      backup="$dest.bak.$(date +%Y%m%d%H%M%S)"
      say "  replace $skill (existing copy kept at $(basename "$backup"))"
      run mv "$dest" "$backup"
    else
      say "  install $skill"
    fi
    run cp -R "$SRC/$skill" "$dest"
    run find "$dest" -name '.DS_Store' -delete
    installed=$((installed + 1))
  done
done

say ""
if [ "$DRY_RUN" -eq 1 ]; then
  say "Dry run complete. Nothing changed."
else
  say "Installed $installed skill$([ "$installed" -eq 1 ] || echo s)."
  say "Codex:       reference a skill as \$coos-qa-test-cases"
  say "Claude Code: restart the session, then use the Skill tool"
  say "Uninstall:   ./install.sh --uninstall"
fi
