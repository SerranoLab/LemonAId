#!/usr/bin/env bash
# Deploy one tagged build of LemonAId to the droplet. Run from a clean checkout of that tag.
#   deploy/deploy.sh v0.8.0 root@lemonaid.serranolab.org
# What it does, in order: builds, checks the build is self-contained, records the SHA-256,
# copies the file to a new release directory on the server, flips the `current` symlink,
# verifies the served file's checksum, and appends one line to deploy/DEPLOY_LOG.md.
# Rollback: deploy/deploy.sh --rollback root@host   (flips `current` back to `previous`).
set -euo pipefail

if [[ "${1:-}" == "--rollback" ]]; then
  HOST="$2"
  ssh "$HOST" 'set -e; cd /var/www/lemonaid; [ -L previous ] || { echo "no previous release"; exit 1; }; P=$(readlink previous); C=$(readlink current); ln -sfn "$P" current; ln -sfn "$C" previous; nginx -t && systemctl reload nginx; echo "rolled back to $P"'
  exit 0
fi

TAG="$1"; HOST="$2"
[[ "$(git describe --tags --exact-match 2>/dev/null)" == "$TAG" ]] || { echo "checkout tag $TAG first (git checkout $TAG)"; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "working tree not clean"; exit 1; }

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

REMOTE_SHA=$(curl -fsSL "https://lemonaid.serranolab.org/LemonAId.html" | shasum -a 256 | cut -d' ' -f1)
if [[ "$REMOTE_SHA" == "$SHA" ]]; then OUT="ok"; else OUT="CHECKSUM MISMATCH"; fi
printf '| %s | %s | %s | %s | %s |\n' "$(date -u +%F)" "$TAG" "$(git config user.name)" "$SHA" "$OUT" >> deploy/DEPLOY_LOG.md
echo "$OUT  $TAG  $SHA"
[[ "$OUT" == "ok" ]]
