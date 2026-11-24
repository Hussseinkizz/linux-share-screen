#!/usr/bin/env bash
# Manual release: bump versions, build the installer + AppImage, tag, push,
# and publish a GitHub release.
#
# Usage: bun run release 1.0.1
set -euo pipefail

VERSION="${1:-}"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "usage: scripts/release.sh <major.minor.patch>" >&2
	exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -n "$(git status --porcelain)" ]; then
	echo "working tree is dirty; commit or stash first" >&2
	exit 1
fi
if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
	echo "releases must be cut from main" >&2
	exit 1
fi
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
	echo "tag v$VERSION already exists" >&2
	exit 1
fi

echo "==> version $VERSION"
sed -i "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/version: \"[0-9.]*\"/version: \"$VERSION\"/" electrobun.config.ts
sed -i "s/APP_VERSION = \"[0-9.]*\"/APP_VERSION = \"$VERSION\"/" src/shared/version.ts
sed -i "s/<release version=\"[0-9.]*\"/<release version=\"$VERSION\"/" assets/linux-screen-share.appdata.xml

echo "==> typecheck"
bun run typecheck

echo "==> build installer + AppImage"
bun run package

SETUP="$(ls artifacts/*-Setup.tar.gz | head -1)"
APPIMAGE="$(ls artifacts/*.AppImage | head -1)"
UPDATE_JSON="$(ls artifacts/*-update.json | head -1)"
DEB="$(ls artifacts/*.deb | head -1)"
SHA="$(sha256sum "$SETUP" | cut -d' ' -f1)"

echo "==> commit, tag, push"
git add -A
git commit -m "Release v$VERSION"
git tag -a "v$VERSION" -m "Linux Screen Share v$VERSION"
git push origin main
git push origin "v$VERSION"

echo "==> GitHub release"
NOTES="$(mktemp)"
sed \
	-e "s/@VERSION@/$VERSION/g" \
	-e "s/@SHA256@/$SHA/g" \
	-e "s/@DATE@/$(date -u +%Y-%m-%d)/g" \
	"RELEASE_NOTES.template.md" > "$NOTES"

gh release create "v$VERSION" \
	"$SETUP" "$APPIMAGE" "$DEB" "$UPDATE_JSON" \
	--title "Linux Screen Share v$VERSION" \
	--notes-file "$NOTES"

rm -f "$NOTES"
echo
echo "Released v$VERSION"
echo "  installer: $SETUP"
echo "  appimage:  $APPIMAGE"
echo "  deb:       $DEB"
