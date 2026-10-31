#!/usr/bin/env bash
# Deploy one tagged build of LemonAId to the droplet. Run from a clean checkout of that tag.
#   deploy/deploy.sh v0.8.0 root@lemonaid.serranolab.org
# What it does, in order: builds, checks the build is self-contained, records the SHA-256,
# copies the file to a new release directory on the server, flips the `current` symlink,
# verifies the served file's checksum, and appends one line to deploy/DEPLOY_LOG.md.
# Rollback: deploy/deploy.sh --rollback root@host   (swaps `current` and `previous`, checks the
# served checksum against that release's VERSION, and logs one line, like a deploy).
set -euo pipefail

WHO="$(git config user.name)"
[[ -n "$WHO" ]] || { echo "git config user.name is empty; the log needs a name"; exit 1; }
URL="https://lemonaid.serranolab.org/LemonAId.html"

if [[ "${1:-}" == "--rollback" ]]; then
  HOST="$2"
  # Swap current and previous on the server, then read the VERSION of what is now served.
  NOW=$(ssh "$HOST" 'set -e; cd /var/www/lemonaid; [ -L previous ] || { echo "no previous release" >&2; exit 1; }; P=$(readlink previous); C=$(readlink current); ln -sfn "$P" current; ln -sfn "$C" previous; nginx -t -q; systemctl reload nginx; cat current/VERSION')
  read -r TAG _STAMP SHA <<<"$NOW"
  REMOTE_SHA=$(curl -fsSL "$URL" | shasum -a 256 | cut -d' ' -f1)
  if [[ "$REMOTE_SHA" == "$SHA" ]]; then OUT="ok (rollback)"; else OUT="ROLLBACK CHECKSUM MISMATCH"; fi
  printf '| %s | %s | %s | %s | %s |\n' "$(date -u +%F)" "$TAG" "$WHO" "$SHA" "$OUT" >> deploy/DEPLOY_LOG.md
  echo "$OUT  $TAG  $SHA"
  [[ "$OUT" == "ok (rollback)" ]]
  exit $?
fi

TAG="$1"; HOST="$2"
[[ "$(git describe --tags --exact-match 2>/dev/null)" == "$TAG" ]] || { echo "checkout tag $TAG first (git checkout $TAG)"; exit 1; }
# The log is the one file a deploy writes, so it may be dirty; anything else must be committed.
# The app shows the version from CITATION.cff, so the tag must agree with it.
CFF_VERSION="v$(sed -n 's/^version:[[:space:]]*"\{0,1\}\([^"[:space:]]*\)"\{0,1\}[[:space:]]*$/\1/p' CITATION.cff)"
[[ "$CFF_VERSION" == "$TAG" ]] || { echo "CITATION.cff says $CFF_VERSION but the tag is $TAG; set the version in the release commit"; exit 1; }
[[ -z "$(git status --porcelain -- . ':!deploy/DEPLOY_LOG.md')" ]] || { echo "working tree not clean"; exit 1; }

node build.cjs
! grep -q '<script[^>]*src=' dist/LemonAId.html || { echo "external script found"; exit 1; }
! grep -q '<link[^>]*href=' dist/LemonAId.html || { echo "external stylesheet found"; exit 1; }
SHA=$(shasum -a 256 dist/LemonAId.html | cut -d' ' -f1)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
REL="/var/www/lemonaid/releases/${TAG}_${STAMP}"

ssh "$HOST" "mkdir -p $REL"
scp -q dist/LemonAId.html "$HOST:$REL/LemonAId.html"
ssh "$HOST" "printf '%s %s %s\n' '$TAG' '$STAMP' '$SHA' > $REL/VERSION"
ssh "$HOST" "set -e; cd /var/www/lemonaid; [ -L current ] && ln -sfn \"\$(readlink current)\" previous || true; ln -sfn $REL current; nginx -t && systemctl reload nginx"

REMOTE_SHA=$(curl -fsSL "$URL" | shasum -a 256 | cut -d' ' -f1)
if [[ "$REMOTE_SHA" == "$SHA" ]]; then OUT="ok"; else OUT="CHECKSUM MISMATCH"; fi
printf '| %s | %s | %s | %s | %s |\n' "$(date -u +%F)" "$TAG" "$WHO" "$SHA" "$OUT" >> deploy/DEPLOY_LOG.md
echo "$OUT  $TAG  $SHA"
[[ "$OUT" == "ok" ]]
