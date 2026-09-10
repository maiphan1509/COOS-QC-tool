#!/usr/bin/env bash
#
# Set the plugin version everywhere it is recorded, and optionally commit + tag.
#
#   ./scripts/bump-version.sh 1.1.0          rewrite manifests and CHANGELOG
#   ./scripts/bump-version.sh 1.1.0 --tag    ...then commit and create tag v1.1.0
#
# Touches:
#   plugins/coos-qc-skills/.claude-plugin/plugin.json   .version
#   .claude-plugin/marketplace.json                     .metadata.version, .plugins[coos-qc-skills].version
#   CHANGELOG.md                                        promotes ## [Unreleased] to ## [x.y.z] - <today>
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PLUGIN_NAME="coos-qc-skills"
PLUGIN_JSON="plugins/$PLUGIN_NAME/.claude-plugin/plugin.json"
MARKET_JSON=".claude-plugin/marketplace.json"
CHANGELOG="CHANGELOG.md"

usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; }
die()   { echo "error: $*" >&2; exit 1; }

VERSION="${1:-}"
TAG=0
case "${2:-}" in
  --tag) TAG=1 ;;
  "") ;;
  *) usage >&2; exit 2 ;;
esac
[ -n "$VERSION" ] || { usage >&2; exit 2; }
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || die "'$VERSION' is not a semver string (x.y.z or x.y.z-pre)"
command -v python3 >/dev/null 2>&1 || die "python3 is required"
[ -f "$PLUGIN_JSON" ] || die "$PLUGIN_JSON not found"
[ -f "$MARKET_JSON" ] || die "$MARKET_JSON not found"

current="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$PLUGIN_JSON")"
if [ "$current" = "$VERSION" ]; then
  die "already at $VERSION"
fi
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null 2>&1; then
  die "tag v$VERSION already exists"
fi

python3 - "$VERSION" "$PLUGIN_NAME" "$PLUGIN_JSON" "$MARKET_JSON" "$CHANGELOG" <<'PY'
import datetime, json, sys

version, plugin_name, plugin_path, market_path, changelog_path = sys.argv[1:6]

def rewrite_json(path, mutate):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    mutate(data)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

def bump_plugin(d):
    d["version"] = version

def bump_market(d):
    d.setdefault("metadata", {})["version"] = version
    hits = [p for p in d.get("plugins", []) if p.get("name") == plugin_name]
    if not hits:
        sys.exit(f"error: no plugin named {plugin_name!r} in {market_path}")
    for p in hits:
        p["version"] = version

rewrite_json(plugin_path, bump_plugin)
rewrite_json(market_path, bump_market)

# CHANGELOG: everything under "## [Unreleased]" becomes the new version's section.
try:
    with open(changelog_path, encoding="utf-8") as f:
        lines = f.read().split("\n")
except FileNotFoundError:
    print(f"note: {changelog_path} not found, skipped")
    sys.exit(0)

header = f"## [{version}] - {datetime.date.today().isoformat()}"
if any(l.startswith(f"## [{version}]") for l in lines):
    print(f"note: {changelog_path} already has a {version} section, left unchanged")
    sys.exit(0)
try:
    i = next(i for i, l in enumerate(lines) if l.strip() == "## [Unreleased]")
except StopIteration:
    print(f"note: {changelog_path} has no '## [Unreleased]' heading, left unchanged")
    sys.exit(0)

# Warn when Unreleased is empty: the new section would have no entries.
j = i + 1
while j < len(lines) and not lines[j].startswith("## "):
    j += 1
if not any(l.strip() for l in lines[i + 1:j]):
    print(f"warning: '## [Unreleased]' is empty; {version} section added with no entries")

lines[i + 1:i + 1] = ["", header]
with open(changelog_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
PY

echo "version: $current -> $VERSION"
git --no-pager diff --stat -- "$PLUGIN_JSON" "$MARKET_JSON" "$CHANGELOG" | sed 's/^/  /'

if [ "$TAG" -eq 1 ]; then
  git add -- "$PLUGIN_JSON" "$MARKET_JSON" "$CHANGELOG"
  git commit -q -m "chore: release v$VERSION"
  git tag -a "v$VERSION" -m "v$VERSION"
  echo "committed and tagged v$VERSION"
  echo "publish with: git push --follow-tags"
else
  echo "review the diff, then: git commit -am 'chore: release v$VERSION' && git tag v$VERSION"
fi
