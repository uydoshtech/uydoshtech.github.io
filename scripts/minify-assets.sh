#!/usr/bin/env bash
# Minifies every JS/CSS file under assets/ in place using esbuild.
#
# This is meant to run against a disposable checkout right before deploying
# (see .github/workflows/deploy.yml) — it overwrites files in place, so don't
# run it against your own working copy unless you're fine re-cloning
# afterwards. No package.json is committed to this repo on purpose (it's a
# plain static site with no build step for local development); esbuild is
# installed on the fly into a throwaway prefix instead of the repo itself.
set -euo pipefail

cd "$(dirname "$0")/.."

ESBUILD_VERSION="0.24.2"
TOOLDIR="$(mktemp -d)"
trap 'rm -rf "$TOOLDIR"' EXIT

echo "Installing esbuild@${ESBUILD_VERSION}..."
npm install --prefix "$TOOLDIR" "esbuild@${ESBUILD_VERSION}" --no-audit --no-fund --no-package-lock >/dev/null
ESBUILD="$TOOLDIR/node_modules/.bin/esbuild"

js_count=0
while IFS= read -r -d '' f; do
  # --charset=utf8 matters here: without it esbuild defaults to ASCII output
  # and escapes every non-ASCII character (e.g. the Cyrillic/Uzbek strings in
  # assets/i18n/*.js) as \uXXXX, which can make a minified file *larger* than
  # the source, even after gzip.
  "$ESBUILD" "$f" --minify --target=es2019 --charset=utf8 --outfile="$f" --allow-overwrite --log-level=warning
  js_count=$((js_count + 1))
done < <(find assets -type f -name '*.js' -print0)

css_count=0
while IFS= read -r -d '' f; do
  "$ESBUILD" "$f" --minify --charset=utf8 --outfile="$f" --allow-overwrite --log-level=warning
  css_count=$((css_count + 1))
done < <(find assets -type f -name '*.css' -print0)

echo "Minified ${js_count} JS file(s) and ${css_count} CSS file(s) under assets/."
