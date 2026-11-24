# Screen Share

One-window Linux desktop app: press **Share my screen**, open the link on your
TV, phone, or laptop, and watch. No pnpm, no CLI, no Caddy, no sudo — the
patched relay engine, its viewer, and the Cloudflare tunnel client are bundled
with the app.

See `SPEC.md` for the product spec, decision records, and accepted compromises.

## Requirements (development)

- Linux x86_64 with WebKitGTK (`webkit2gtk-4.1`), Bun ≥ 1.4, `openssl`.
- `~/CODE/screen-relay` checked out and built (provides `relay-engine` and the
  viewer source):

  ```sh
  make -C ~/CODE/screen-relay BACKENDS="x11 wayland" relay-engine
  ```

## Run

```sh
bun install
bun run resources        # build viewer + copy engine into resources/
bun run fetch:cloudflared # once: download cloudflared (~38 MiB)
bun run start            # build UI + launch the app
```

Headless checks:

```sh
bun run typecheck
bun run smoke lan        # engine + viewer on https://<lan-ip>:8137
bun run smoke internet   # engine behind a Cloudflare quick tunnel
```

## How it works

- Attaches to the current session (`WAYLAND_DISPLAY`, else `DISPLAY`) with the
  patched engine (COSMIC needs the ext-image-copy-capture backend).
- **Home network** mode: engine binds `0.0.0.0:8137…8147` with a generated
  self-signed certificate and `--public-origin https://<lan-ip>:<port>`.
- **Internet** mode: bundled `cloudflared` quick tunnel gives a trusted HTTPS
  name, then the engine runs loopback-only behind it (`--behind-tls-proxy`).
- A stable 64-hex token lives in `~/.local/share/linux-screen-share/token`
  (0600); links carry it in the URL fragment. **New link** rotates it.
- Logs: `~/.local/share/linux-screen-share/app.log`; config in
  `~/.config/linux-screen-share/config.json`.

## Known limitations (v1)

- Viewing + typing only on COSMIC: no pointer injection (no virtual-pointer
  protocol). Movies: fine.
- **No audio** — the engine streams video only. Movies are silent on the
  viewing device.
- Viewing devices need WebCodecs H.264 (MSE fallback planned).
- Home-network mode shows a self-signed certificate warning; TV browsers may
  refuse it — use Internet mode for TVs.
- Quick-tunnel URLs are random per session (named tunnel later).
- One physical display; Linux x86_64 only.
