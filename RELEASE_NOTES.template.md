# Linux Screen Share v@VERSION@

**A simple app to share any Linux device screen to a smart TV or any browser
over the network, local or remote, easily.**

## Install

### Debian and Ubuntu

```sh
sudo apt install ./screen-share_@VERSION@_amd64.deb
```

APT pulls in WebKitGTK and the other runtime libraries.

### AppImage (no sudo)

```sh
chmod +x Linux-Screen-Share-x86_64.AppImage
./Linux-Screen-Share-x86_64.AppImage
# Without FUSE 2 (Ubuntu 23.10+):
# ./Linux-Screen-Share-x86_64.AppImage --appimage-extract-and-run
```

### Installer archive

Download `stable-linux-x64-ScreenShare-Setup.tar.gz`, extract it, run
`./installer`. Installs to `~/.local/share` and adds a desktop shortcut.

The AppImage and the installer archive use the system WebKitGTK; the .deb
declares it as a dependency.

Requires GTK 3 and WebKitGTK 4.1 (`libwebkit2gtk-4.1-0`), present on current
Pop!_OS/Ubuntu, Fedora, Arch and openSUSE desktops. Manual dependency commands
are in the README.

## Use

1. Open **Screen Share**.
2. Choose **Internet** (works on TVs, valid certificate) or **Home network**.
3. Press **Share my screen**, then open the copied link or scan the QR.

## Notes

- Desktop audio with a Sound on and Sound off button in the viewer.
- Microphone capture is not available yet.
- COSMIC: typing works, mouse control does not (platform protocol gap).
- Viewing devices need WebCodecs H.264; some TV browsers do not have it.
- Home-network mode shows a self-signed certificate warning; Internet mode
  gives a fresh `*.trycloudflare.com` URL each session.
- Linux x86_64.

## Checksums

```
@SHA256@  stable-linux-x64-ScreenShare-Setup.tar.gz
```

Built @DATE@ from source at `v@VERSION@`. Engine: vercel-labs/screen-relay at
`47719f1` with the patch in `engine/patch/`. Licenses: GPL-2.0 (app), see
`THIRD-PARTY.md` for bundled components.
