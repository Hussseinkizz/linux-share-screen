# Linux Screen Share

**A simple app to share any Linux device screen to a smart TV or any browser
over the network — local or remote — easily.**

Press one button, get a link (or QR code), open it on your TV, phone, or
laptop, and watch. No accounts, no setup wizard, no pnpm/CLI/Caddy/sudo. The
app bundles its streaming engine, viewer, and Cloudflare tunnel client.

- 🖥️ Captures the real desktop on Wayland (COSMIC, Sway, Hyprland) and X11.
- 📺 Two modes: **Home network** (direct LAN HTTPS) and **Internet**
  (Cloudflare quick tunnel — real HTTPS certificate, works on TVs, no warning).
- 🔗 Stable links: a 64-hex token persists across restarts; **New link**
  rotates it.
- 🎞️ 1080p60 H.264, adaptive bitrate, typematic keyboard input.
- 🪶 One small window. One big button.

## Install

### Option A — AppImage (no sudo)

1. Download `Linux-Screen-Share-x86_64.AppImage` from the
   [releases page](https://github.com/Hussseinkizz/linux-share-screen/releases).
2. `chmod +x Linux-Screen-Share-x86_64.AppImage`
3. Double-click it, or run `./Linux-Screen-Share-x86_64.AppImage`.

If your distro lacks FUSE 2 (Ubuntu 23.10+ ships FUSE 3 only), run:

```sh
./Linux-Screen-Share-x86_64.AppImage --appimage-extract-and-run
```

### Option B — Installer archive

Download `stable-linux-x64-ScreenShare-Setup.tar.gz`, extract it, and run
`./installer` (or double-click it). It installs to `~/.local/share` and adds a
desktop shortcut. No sudo.

### Runtime requirements

Any modern desktop with GTK 3 and **WebKitGTK 4.1** (`libwebkit2gtk-4.1-0`).
Both are present on current Pop!_OS/Ubuntu, Fedora, Arch, and openSUSE
desktops. If the app does not start, install the dependencies:

```sh
# Debian / Ubuntu / Pop!_OS
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0

# Fedora
sudo dnf install webkit2gtk4.1 gtk3

# Arch / Manjaro
sudo pacman -S webkit2gtk-4.1 gtk3

# openSUSE
sudo zypper install libwebkit2gtk-4_1-0 gtk3
```

Home-network mode also needs `openssl` (already present on mainstream
distros) to generate its self-signed certificate.

## Use

1. Open **Screen Share**.
2. Choose **Internet** (recommended for TVs — valid certificate, works on any
   network) or **Home network** (same Wi-Fi, may show a certificate warning).
3. Press **Share my screen**.
4. On the other device, open the link from **Copy**, or scan **Show QR**.

Stop with **Stop sharing**; quitting the app always stops everything.

## Known limitations (v1)

- **No audio yet.** Video only — movies are silent on the viewing device.
  Audio is the next feature after this release.
- **No mouse control on COSMIC.** COSMIC has no virtual-pointer protocol;
  typing works, clicking does not. (Sway/Hyprland virtual desktops allow it.)
- Viewing devices need **WebCodecs H.264** support. Most desktop browsers and
  recent Android TVs work; some TV browsers do not (MSE fallback planned).
- **Home-network mode** uses a self-signed certificate: accept the warning on
  the other device. Some TV browsers refuse it — use Internet mode on TVs.
- Internet mode gets a **new random `*.trycloudflare.com` URL** each session.
  Named tunnels/custom domains are planned.
- One physical display; Linux x86_64.

## Build from source

Requirements: Bun ≥ 1.4, C++ toolchain, and the engine's build dependencies.

```sh
git clone https://github.com/Hussseinkizz/linux-share-screen.git
cd linux-share-screen
bun install

# engine build deps (Debian/Ubuntu example):
sudo apt install build-essential pkg-config libwebsockets-dev libx264-dev \
  libcap-dev zlib1g-dev libwayland-dev wayland-protocols libxkbcommon-dev \
  libx11-dev libxdamage-dev libxfixes-dev libxtst-dev \
  libgtk-3-dev libwebkit2gtk-4.1-dev

bun run fetch:cloudflared        # download the tunnel client once
bun scripts/bootstrap-engine.sh  # clone pinned upstream + apply engine patch
LSS_SCREEN_RELAY=.engine/screen-relay bun run resources

bun run start                    # dev run
bun run package                  # installer archive + AppImage
```

Headless checks:

```sh
bun run typecheck
bun run smoke lan
bun run smoke internet
```

### Cutting a release

```sh
bun run release 1.0.1   # bumps versions, builds, tags, pushes, creates the GitHub release
```

## How it works

The app is a control surface around the
[**screen-relay**](https://github.com/vercel-labs/screen-relay) engine
(Apache-2.0, by Vercel Labs), patched in `engine/patch/` to support the
standard `ext-image-copy-capture` Wayland protocol used by COSMIC (upstream
only speaks `wlr-screencopy`). The engine captures, encodes H.264 with x264,
serves the viewer and WebSocket stream, and handles token auth.

- **Home network:** engine binds `0.0.0.0:8137–8147` with a generated
  self-signed certificate and `--public-origin https://<lan-ip>:<port>`.
- **Internet:** bundled `cloudflared` opens a quick tunnel, then the engine
  runs loopback-only behind it (`--behind-tls-proxy`).
- Links carry the token in the URL fragment, so it never reaches the server or
  tunnel logs.

State lives in `~/.local/share/linux-screen-share/` (token 0600, certs, logs);
config in `~/.config/linux-screen-share/config.json`.

## Credits

- **[screen-relay](https://github.com/vercel-labs/screen-relay)** by
  **Vercel Labs** — the streaming engine, wire protocol, and web viewer this
  app is built on. Huge thanks: this app would not exist without it.
- **[Electrobun](https://github.com/blackboardsh/electrobun)** — the Bun +
  native-webview desktop framework.
- **[cloudflared](https://github.com/cloudflare/cloudflared)** — Cloudflare
  tunnels.
- **[Bun](https://bun.sh)** — runtime and tooling.
- **[x264](https://www.videolan.org/developers/x264.html)** — H.264 encoding.
- The `ext-image-copy-capture` protocol designers and the COSMIC team.

Third-party licenses are listed in [`THIRD-PARTY.md`](./THIRD-PARTY.md).

## License

GNU General Public License v2.0 — see [`LICENSE`](./LICENSE). The bundled
screen-relay components remain Apache-2.0 and cloudflared remains Apache-2.0;
see `THIRD-PARTY.md` for details.

## Roadmap

Audio capture · AppImage with bundled WebKit · MSE fallback for TVs · named
tunnels · virtual desktop mode with mouse control · multi-monitor picker.
