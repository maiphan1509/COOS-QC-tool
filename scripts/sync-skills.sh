#!/usr/bin/env bash
#
# Mirror the canonical skills in .codex/skills to every other agent runtime tree.
#
#   ./scripts/sync-skills.sh          rewrite the mirrors
#   ./scripts/sync-skills.sh --check  exit 1 if any mirror is stale (for CI)
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
