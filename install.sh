#!/bin/sh
# Linux Screen Share installer.
#
# Downloads the latest AppImage release, verifies its checksum, installs it for
# the current user, and adds a desktop entry. No administrator rights needed.
#
#   curl -fsSL https://raw.githubusercontent.com/Husseinkizz/linux-share-screen/main/install.sh | sh
#
# Options:
#   LSS_VERSION=1.2.0      install a specific release instead of the latest
#   LSS_BIN_DIR=...        install the launcher elsewhere (default ~/.local/bin)
#   ./install.sh --uninstall
set -eu

REPO="Husseinkizz/linux-share-screen"
VERSION="${LSS_VERSION:-latest}"
BIN_DIR="${LSS_BIN_DIR:-$HOME/.local/bin}"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/linux-screen-share"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/256x256/apps"

if [ "${1:-}" = "--uninstall" ]; then
	rm -f "$BIN_DIR/linux-screen-share"
	rm -f "$APPS_DIR/dev.linuxscreenshare.app.desktop"
	rm -f "$ICON_DIR/linux-screen-share.png"
	rm -rf "$DATA_DIR"
	echo "Linux Screen Share removed."
	exit 0
fi

if [ "$(uname -m)" != "x86_64" ]; then
	echo "Only x86_64 is supported by the current release." >&2
	exit 1
fi

if [ "$VERSION" = "latest" ]; then
	BASE="https://github.com/$REPO/releases/latest/download"
else
	BASE="https://github.com/$REPO/releases/download/v$VERSION"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading Linux Screen Share ($VERSION)..."
curl -fL --proto '=https' --tlsv1.2 -o "$TMP/app.AppImage" \
	"$BASE/Linux-Screen-Share-x86_64.AppImage"
curl -fL --proto '=https' --tlsv1.2 -o "$TMP/SHA256SUMS" "$BASE/SHA256SUMS"

EXPECTED="$(awk '/Linux-Screen-Share-x86_64.AppImage$/ {print $1}' "$TMP/SHA256SUMS")"
ACTUAL="$(sha256sum "$TMP/app.AppImage" | awk '{print $1}')"
if [ -z "$EXPECTED" ] || [ "$EXPECTED" != "$ACTUAL" ]; then
	echo "Checksum verification failed; aborting." >&2
	exit 1
fi
echo "Checksum verified."

mkdir -p "$BIN_DIR" "$DATA_DIR" "$APPS_DIR" "$ICON_DIR"
install -m 755 "$TMP/app.AppImage" "$DATA_DIR/Linux-Screen-Share.AppImage"

cat > "$BIN_DIR/linux-screen-share" <<'LAUNCHER'
#!/bin/sh
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/linux-screen-share"
APP="$DATA/Linux-Screen-Share.AppImage"
if [ -e /dev/fuse ] && ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
	exec "$APP" "$@"
fi
exec "$APP" --appimage-extract-and-run "$@"
LAUNCHER
chmod 755 "$BIN_DIR/linux-screen-share"

curl -fsSL -o "$ICON_DIR/linux-screen-share.png" \
	"https://raw.githubusercontent.com/$REPO/main/assets/icon.png" || rm -f "$ICON_DIR/linux-screen-share.png"

cat > "$APPS_DIR/dev.linuxscreenshare.app.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Linux Screen Share
Comment=Share this Linux screen to any TV or browser
Exec=$BIN_DIR/linux-screen-share
Icon=linux-screen-share
Categories=Network;RemoteAccess;
Terminal=false
DESKTOP
chmod 644 "$APPS_DIR/dev.linuxscreenshare.app.desktop"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q "$APPS_DIR" || true

echo
echo "Installed to $DATA_DIR"
echo "Launcher: $BIN_DIR/linux-screen-share"
if command -v xdg-open >/dev/null 2>&1; then
	echo "Open Linux Screen Share from the application menu, or run: $BIN_DIR/linux-screen-share"
else
	echo "Run: $BIN_DIR/linux-screen-share"
fi
