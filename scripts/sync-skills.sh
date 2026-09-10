#!/usr/bin/env bash
#
# Lint the canonical skills in .codex/skills, then mirror them to every other
# agent runtime tree.
#
#   ./scripts/sync-skills.sh          lint, then rewrite the mirrors
#   ./scripts/sync-skills.sh --check  lint, then exit 1 if any mirror is stale (CI)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SOURCE=".codex/skills"
MIRRORS=(
  ".claude/skills"
  ".agents/skills"
  "plugins/coos-qc-skills/skills"
)
# Claude Code truncates skill descriptions beyond this; a truncated description
# changes when the skill triggers.
MAX_DESCRIPTION=1024

if [ ! -d "$SOURCE" ]; then
  echo "error: source '$SOURCE' not found; run from a checkout of COOS-QC-tool" >&2
  exit 1
fi

CHECK_ONLY=0
case "${1:-}" in
  --check) CHECK_ONLY=1 ;;
  "") ;;
  *) echo "usage: $0 [--check]" >&2; exit 2 ;;
esac

# ------------------------------------------------------------------- lint

# Print the YAML front matter of $1 without its --- fences.
# Fails when the file does not open with --- or never closes the block.
front_matter() {
  awk '
    NR == 1     { if ($0 != "---") exit 1; next }
    $0 == "---" { closed = 1; exit }
                { print }
    END         { if (!closed) exit 1 }
  ' "$1"
}

# fm_value <front-matter-text> <key>  ->  scalar value, surrounding quotes removed
fm_value() {
  printf '%s\n' "$1" \
    | sed -n "s/^$2:[[:space:]]*//p" \
    | head -n 1 \
    | sed -e "s/^[\"']//" -e "s/[\"']\$//"
}

# Every skill needs: SKILL.md with front matter, name == directory name,
# a non-empty description within the size limit, and Codex metadata.
lint_skills() {
  local errors=0 count=0 dir name skill fm value
  for dir in "$SOURCE"/*/; do
    dir="${dir%/}"
    name="$(basename "$dir")"
    skill="$dir/SKILL.md"
    count=$((count + 1))

    if [ ! -f "$skill" ]; then
      echo "lint: $name: missing SKILL.md" >&2
      errors=$((errors + 1)); continue
    fi
    if ! fm="$(front_matter "$skill")"; then
      echo "lint: $name: SKILL.md must open with a closed --- front matter block" >&2
      errors=$((errors + 1)); continue
    fi

    value="$(fm_value "$fm" name)"
    if [ "$value" != "$name" ]; then
      echo "lint: $name: front matter name is '$value', must equal the directory name" >&2
      errors=$((errors + 1))
    fi

    value="$(fm_value "$fm" description)"
    case "$value" in
      "")
        echo "lint: $name: front matter description is empty" >&2
        errors=$((errors + 1)) ;;
      ">" | "|" | ">-" | "|-")
        ;;  # block scalar; length not checked
      *)
        if [ "${#value}" -gt "$MAX_DESCRIPTION" ]; then
          echo "lint: $name: description is ${#value} chars, max $MAX_DESCRIPTION" >&2
          errors=$((errors + 1))
        fi ;;
    esac

    if [ ! -f "$dir/agents/openai.yaml" ]; then
      echo "lint: $name: missing agents/openai.yaml (Codex metadata)" >&2
      errors=$((errors + 1))
    fi
  done

  if [ "$errors" -gt 0 ]; then
    echo "lint: $errors problem(s) in $SOURCE" >&2
    return 1
  fi
  echo "lint: $count skills OK"
}

# ------------------------------------------------------------------ mirror

# Copy $SOURCE into $1, dropping OS metadata. rsync when available, cp otherwise.
copy_tree() {
  local dest="$1"
  rm -rf "$dest"
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude '.DS_Store' --exclude '__pycache__' "$SOURCE"/ "$dest"/
  else
    cp -R "$SOURCE"/. "$dest"/
    find "$dest" -name '.DS_Store' -delete
    find "$dest" -name '__pycache__' -type d -prune -exec rm -rf {} +
  fi
}

# Print "<relative-path> <sha>" for every file under $1, sorted. Used by --check.
fingerprint() {
  local root="$1"
  [ -d "$root" ] || { echo "MISSING"; return; }
  local sha
  if command -v shasum >/dev/null 2>&1; then sha="shasum -a 256"; else sha="sha256sum"; fi
  ( cd "$root" \
    && find . -type f ! -name '.DS_Store' -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 $sha 2>/dev/null \
    | awk '{print $2, $1}' )
}

# -------------------------------------------------------------------- main

lint_skills

if [ "$CHECK_ONLY" -eq 1 ]; then
  stale=0
  expected="$(fingerprint "$SOURCE")"
  for dest in "${MIRRORS[@]}"; do
    if [ "$(fingerprint "$dest")" != "$expected" ]; then
      echo "stale: $dest" >&2
      stale=1
    fi
  done
  if [ "$stale" -eq 1 ]; then
    echo "run ./scripts/sync-skills.sh and commit the result" >&2
    exit 1
  fi
  echo "all mirrors match $SOURCE"
  exit 0
fi

find "$SOURCE" -name '.DS_Store' -delete 2>/dev/null || true

for dest in "${MIRRORS[@]}"; do
  copy_tree "$dest"
  echo "synced $SOURCE -> $dest"
done

count=$(find "$SOURCE" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
echo "done: $count skills mirrored to ${#MIRRORS[@]} trees"
