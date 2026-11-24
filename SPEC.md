# linux-screen-share, Spec & Decision Records

Status: approved and in build. Date: 2026-11-22 (updated 2026-11-24).
Source of truth for the app. Code follows this file; when code and file
disagree, fix one.

## 1. Product

One job: **install the app, open it, press Share, open the link on a TV/phone,
watch.**

- Single user, single machine (Linux desktop; COSMIC Wayland is the target).
- Immediate goal: watch video from another device on the same LAN, or from
  anywhere through a Cloudflare tunnel.
- No accounts, no dashboard, no mobile app, no setup wizard, no external
  installs.

## 2. Non-goals (for now)

- No mouse/keyboard control of the real COSMIC desktop (platform limitation,
  ADR-010).
- No MSE fallback, no extra codecs, no virtual desktop mode (phases 3–4).
- No Windows/macOS builds yet.
- No named Cloudflare tunnels or custom domains yet.
- No audio capture (ADR-014).

## 3. UI / UX, super simple

One window (~560×520), one screen, three states, no navigation.

**Idle**
- Title `Screen Share`; status pill `Not sharing`.
- Segmented control: `Home network` | `Internet`, with a one-line hint.
- One big button: `Share my screen`.
- Footer: `New link` (rotate token) and version.

**Starting**
- Pill `Starting…` with pulsing dot; button shows a spinner and is disabled.

**Sharing**
- Pill `Sharing` (green).
- Read-only link box + `Copy`, `Show QR`, `Open here`.
- Caption: “Open this link on your TV or phone. Typing works; the mouse stays
  on this computer.”

**Error**
- Pill `Needs attention`; human message + `Details` disclosure with the last
  log lines. No stack traces in the main view.

Rules: no sidebar, no tabs, no menus, no first-run dialogs. Defaults always
work. `Space` toggles sharing when the window has focus.

## 4. Architecture

```
Electrobun app (Bun main + React webview, Linux WebKitGTK)
  ├─ resources/relay-engine      patched engine (x11 + wayland), Apache-2.0
  ├─ resources/viewer/           built from ../screen-relay (index.html + viewer.js)
  ├─ resources/cloudflared       bundled tunnel client (internet mode)
  └─ src/bun/session.ts          spawn/stop engine, token, cert, readiness, tunnel
        ↕ Electrobun RPC
     src/mainview/               React UI (one screen)
```

- **Engine is spawned, not reimplemented.** The app owns the process and flags.
- **Attach mode:** `--backend wayland` when `WAYLAND_DISPLAY` is set, else
  `x11` when `DISPLAY` is set. The engine inherits the app's environment; there
  is no `--display` flag (an earlier draft wrongly assumed one).
- **State dir:** `~/.local/share/linux-screen-share/`, `token` (stable
  64-hex, mode 0600), `certs/`, `app.log`.
- **Config:** `~/.config/linux-screen-share/config.json`, last mode/port.
- **Stable token:** generated at first run, reused until `New link`.
- **LAN mode:** engine binds `0.0.0.0:<port>` with native TLS and
  `--public-origin https://<lan-ip>:<port>` (mandatory: without it the engine
  refuses the page's WebSocket). Link `https://<lan-ip>:<port>/#token=…`.
- **Internet mode:** spawn bundled `cloudflared tunnel --url
  http://127.0.0.1:<port> --no-autoupdate`, parse
  `https://<random>.trycloudflare.com`, then start the engine with
  `--bind 127.0.0.1 --behind-tls-proxy --public-origin https://<tunnel-host>`.
  Link `https://<tunnel-host>/#token=…`. Cloudflare terminates TLS with a
  trusted cert, so TVs need no certificate exception.
- **Readiness:** engine writes `{"ready":true,"pid":…,"port":…}` as its first
  stdout line; the app waits for that JSON (25 s), then publishes the link.
- **Ports:** engine default `8137`, scanning `8137…8147` for a free one
  (`screen-relay` itself uses 8080; the app must not collide).
- **Cleanup:** app quit / Stop kills engine + cloudflared; the link stops
  working.

### Engine flags used (verified in `src/engine/server/config.cpp`)

```
relay-engine --backend wayland| x11 --port <port> \
  --token-file <state>/token --viewer-dir <resources>/viewer \
  [lan]  --bind 0.0.0.0 --public-origin https://<lan-ip>:<port> \
         --tls-cert <state>/certs/cert.pem --tls-key <state>/certs/key.pem \
  [net]  --bind 127.0.0.1 --behind-tls-proxy --public-origin https://<tunnel-host>
```

- Token file must be owned by the user, ≤66 bytes, exactly 64 lowercase hex,
  no group/other permission bits (the app writes 0600).
- COSMIC requires the patched engine (see `engine/README.md`); stock engines
  fail with `zwlr_screencopy_manager_v1` missing.
- Viewer assets are required at `--viewer-dir`.

## 5. Decision records

### ADR-001, Wrap relay-engine, don't write a new streamer
**Context:** screen-relay already captures, encodes (x264), serves TLS, auth,
the wire protocol, and the viewer.
**Decision:** the app is a control surface; bundle the patched engine and spawn
it directly (not the screen-relay CLI supervisor).
**Consequences:** tiny app; inherits engine limits (H.264, WebCodecs, no audio).

### ADR-002, Electrobun 1.18.1, minimal scaffold (do not copy lazier)
**Context:** lazier is a working Electrobun Linux app but a large AI workspace.
**Decision:** new minimal project; reuse only the patterns (`electrobun.config`,
`vite.config`, RPC bridge).
**Consequences:** small build. Pinned to 1.18.1 because it is proven on this
machine.

### ADR-003, App owns a stable token
**Decision:** one 64-hex token generated at first run, stored 0600, passed via
`--token-file`. `New link` rotates it.
**Consequences:** links survive restarts; rotating revokes old links.

### ADR-004, Tunnel-first for TVs, LAN as convenience
**Context:** the viewer requires HTTPS (or localhost); TV browsers usually
reject self-signed certs.
**Decision:** Internet mode (Cloudflare quick tunnel) is the recommended path
for TVs; Home-network mode is the same-Wi-Fi path and may show one cert warning.
**Consequences:** quick-tunnel URLs are random per start; named tunnels later.

### ADR-005, Bundle binaries as app resources
**Decision:** ship `relay-engine`, `viewer/`, `cloudflared` inside the app.
**Consequences:** no pnpm, no CLI, no Caddy, no setcap, no systemd. Bigger
download (~40 MB cloudflared).

### ADR-006, One-button UI
**Decision:** idle = one Share button; sharing = link + copy + QR + Stop.
**Consequences:** no settings page; engine defaults (60 fps, 8 Mb/s start).

### ADR-007, No privileged port 80
**Decision:** engine port 8137–8147; the link carries host:port. QR for phones.
**Consequences:** LAN TV URL is `https://<ip>:8137/#token=…`; named tunnel later
gives a clean hostname.

### ADR-008, MSE fallback before new codecs
**Decision:** if a TV lacks WebCodecs H.264, add a fragmented-MP4 MSE path in
the viewer before considering VP8/VP9/AV1.
**Consequences:** deferred; v1 requires WebCodecs-capable browsers.

### ADR-009, Ship the patched engine, not upstream
**Decision:** bundle `../screen-relay/relay-engine` (ext-image-copy-capture,
optional pointer), keep Apache-2.0 LICENSE/NOTICE and note modifications.
**Consequences:** tied to the patch until upstream merges.

### ADR-010, No mouse on COSMIC attach (accepted)
**Context:** COSMIC exposes no virtual-pointer protocol.
**Decision:** UI wording is honest: viewing + typing only; mouse support needs
virtual desktop mode later.
**Consequences:** fine for watching movies.

### ADR-011, Ports 8137–8147
**Decision:** avoid 8080, which the screen-relay CLI uses on this machine.
**Consequences:** scan upward if busy; remember last good port in config.

### ADR-012, Readiness from engine stdout JSON
**Decision:** wait for `{"ready":true,…}` rather than polling HTTP.
**Consequences:** deterministic, faster, no TLS trust needed to detect startup.

### ADR-013, Certificates via openssl, not a JS library
**Context:** LAN mode needs a self-signed cert; adding a pure-JS X.509 library
means another dependency surface.
**Decision:** generate with `openssl req -x509` (present on every mainstream
Linux desktop), including SAN `IP:<lan-ip>,IP:127.0.0.1,DNS:localhost`;
regenerate when the LAN IP changes.
**Consequences:** if openssl is absent, LAN mode shows a clear error; Internet
mode is unaffected.

### ADR-014, Audio is out of scope for v1
**Context:** the engine streams video only; the movie use case would benefit
from sound.
**Decision:** ship video-only; document it. Audio capture/muxing is a separate
engine feature (next candidate after v1).
**Consequences:** shared movies are silent on the viewing device.

## 6. Accepted compromises (for now)

1. Self-signed cert warning in Home-network mode (tunnel mode removes it).
2. The link is a bearer capability; anyone with it can watch. `New link`
   revokes old links.
3. LAN URL includes a port (8137), no privileged port 80.
4. H.264 + WebCodecs only; no MSE fallback yet.
5. COSMIC attach: no mouse.
6. Quick tunnel gives a random `trycloudflare.com` URL each run.
7. Video only, no audio (ADR-014).
8. Linux x86_64 only for v1 packaging.
9. Single physical display (first output).

## 7. Build phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, bundle engine+viewer, stable token, LAN mode, UI | done |
| 2 | Bundle cloudflared, tunnel mode | done |
| 3 | UX polish: error mapping, QR, rotation, details | mostly done |
| 4 | Virtual desktop mode + browser launch (full mouse control) | later |
| 5 | MSE fallback in viewer for TV decode | later |
| 6 | Packaging: `.deb` / `.AppImage` | later |

## 8. Environment notes

- Target desktop: Linux with Wayland (tested on COSMIC) or X11.
- Engine: the patched build from the pinned upstream commit.
- Viewer: built from the engine checkout by `scripts/sync-resources.mjs`.
- Runtime libraries: GTK 3 and WebKitGTK 4.1; `openssl` for home network
  certificates.
- Toolchain: Bun 1.4 or newer, C++ compiler, and the engine build packages
  listed in the README.

## 9. Open questions

- Packaging preference: `.deb` vs `.AppImage` vs both?
- Domain on Cloudflare for a named tunnel (`share.example.com`)? Not blocking.
- Audio after v1? (recommended, movies are silent today)

## 10. Done definition

**Phase 1:** `bun run smoke` starts a LAN session and serves the viewer;
`bun run start` opens the window; Share produces a working link; another LAN
device plays video after accepting the cert; Stop frees the port and the link
dies; no pnpm/CLI/Caddy/sudo required.

**Phase 2:** same with Internet mode over `https://*.trycloudflare.com` with no
certificate prompt on a TV browser.
