#!/usr/bin/env bash
# Publish the built site to the gh-pages branch (no GitHub Actions involved).
# Usage: npm run deploy        (or: bash tools/deploy.sh)
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT="$(pwd)"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-gh-pages}"

echo "> building"
npm run build

if [ ! -f dist/index.html ]; then
  echo "x dist/index.html missing - build failed" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "> staging dist/ as a standalone commit"
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"

NAME="$(git -C "$PROJECT" config user.name || echo deploy)"
EMAIL="$(git -C "$PROJECT" config user.email || echo deploy@local)"
REMOTE_URL="$(git -C "$PROJECT" remote get-url "$REMOTE")"

(
  cd "$TMP"
  git init -q
  git checkout -q -b "$BRANCH"
  git add -A
  git -c user.name="$NAME" -c user.email="$EMAIL" \
    commit -q -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git remote add origin "$REMOTE_URL"
  git push -q --force origin "$BRANCH"
)

echo "> pushed $BRANCH -> $REMOTE_URL"
echo
echo "First time only: GitHub > Settings > Pages > Source: Deploy from a branch"
echo "  branch: $BRANCH   folder: / (root)   [Save]"
echo
echo "Site: $(printf '%s' "$REMOTE_URL" \
  | sed -E 's#^git@github\.com:(.+)/(.+)\.git$#https://\1.github.io/\2/#; s#^https://github\.com/(.+)/(.+)\.git$#https://\1.github.io/\2/#')"
