# Architecture

Contributor reference for how Linux Screen Share works.

## Components

```
Electrobun app (Bun main process + React webview)
  resources/relay-engine      patched screen-relay engine (x11 + wayland)
  resources/viewer/           viewer built from the screen-relay checkout
  resources/cloudflared       tunnel client for internet mode
  src/bun/                    session, tunnel, token, certificates, RPC
  src/mainview/               single window UI
```

The app spawns the engine. It does not proxy video; viewing devices connect
directly to the engine, or through the tunnel in internet mode.

## Engine

Built from vercel-labs/screen-relay at a pinned commit, with the changes in
`engine/patch/` (see `engine/README.md`). The patch adds an
ext-image-copy-capture backend used by COSMIC and makes pointer input optional.

Startup contract:

- the engine writes `{"ready":true,"pid":...,"port":...}` to standard output
  when it is listening;
- it requires a private token file (mode 0600, 64 lowercase hexadecimal
  characters);
- it requires viewer assets at `--viewer-dir`.

## Modes

Home network:

- engine binds `0.0.0.0` on a free port in the 8137 to 8147 range;
- certificate generated per LAN address with the address in the subject
  alternative name;
- `--public-origin https://<lan-ip>:<port>` so the engine accepts the page
  origin;
- link: `https://<lan-ip>:<port>/#token=<token>`.

Internet:

- engine binds `127.0.0.1`;
- bundled cloudflared opens a quick tunnel to that port;
- engine runs with `--behind-tls-proxy --public-origin https://<tunnel-host>`;
- link: `https://<tunnel-host>/#token=<token>`.

The token travels in the URL fragment, never to the server or tunnel logs.

## Audio

A second WebSocket at `/audio` carries s16le 48 kHz stereo PCM in 20 ms
chunks. Each frame has a 16 byte header: big-endian u64 timestamp, big-endian
u32 sample rate, one byte channel count, three reserved bytes. The engine
spawns bundled `parec` on the default sink monitor; the app resolves the
monitor with bundled `pactl`. A failed capture disables audio only. The
viewer schedules chunks through an AudioContext and has a Sound on and Sound
off button that mutes through a gain node and remembers the choice per
device.

## Preview

The Preview tab asks the Bun process for a still frame once per second. Bun
fetches `/screenshot.png` from the engine on loopback with the session token
and returns a data URL over RPC. Home network sessions use HTTPS with the
self-signed certificate, so that fetch disables certificate verification for
loopback only.

## Named tunnel

When a tunnel token and hostname are configured, the app starts
`cloudflared tunnel run --token` instead of a quick tunnel, then starts the
engine with `--public-origin https://<hostname>`. The port is fixed at 8137
because the Cloudflare ingress must point at a known local port.

## State

- `~/.local/share/linux-screen-share/token` (0600, stable across sessions)
- `~/.local/share/linux-screen-share/certs/`
- `~/.local/share/linux-screen-share/app.log` (capped at about 1 MB)
- `~/.config/linux-screen-share/config.json` (last mode and port)

## Lifecycle

Stop sharing sends SIGTERM to the engine and tunnel, waits three seconds, then
sends SIGKILL. App quit runs the same shutdown and a synchronous exit handler
kills both children as a last resort. No capture, encoding, or network traffic
remains when the session is stopped.
