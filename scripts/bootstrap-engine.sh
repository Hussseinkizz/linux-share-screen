#!/usr/bin/env bash
# Clone the pinned screen-relay upstream, apply the COSMIC engine patch, and
# build relay-engine. Prints the checkout path on success.
#
# Usage: bun scripts/bootstrap-engine.sh [checkout-dir]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM="${SCREEN_RELAY_REPO:-https://github.com/vercel-labs/screen-relay.git}"
PIN="47719f1"
DEST="${1:-$ROOT/.engine/screen-relay}"

if [ ! -d "$DEST/.git" ]; then
	mkdir -p "$(dirname "$DEST")"
	git clone --quiet "$UPSTREAM" "$DEST"
fi
git -C "$DEST" checkout --quiet "$PIN" || {
	echo "could not check out pinned upstream $PIN" >&2
	exit 1
}

# Overlay the patch (same paths as upstream).
cp -R "$ROOT/engine/patch/." "$DEST/"

make -C "$DEST" BACKENDS="x11 wayland" relay-engine
echo "$DEST"
