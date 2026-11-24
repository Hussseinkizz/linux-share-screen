# Screen Share v1.0.0

Share this Linux desktop to any TV, phone, or laptop browser in one click.

## Install

1. Download `stable-linux-x64-ScreenShare-Setup.tar.gz`.
2. Extract it and run `installer` (double-click, or `./installer`).
3. Launch **Screen Share** from the app menu.

No sudo, no pnpm, no screen-relay CLI, no Caddy, no cloudflared install — the
installer puts everything in `~/.local/share`.

Requires a desktop with WebKitGTK (`libwebkit2gtk-4.1-0`, present on current
Pop!_OS/Ubuntu desktops).

## Use

1. Pick **Internet** (recommended; valid HTTPS, no certificate prompts on TVs)
   or **Home network**.
2. Press **Share my screen**.
3. Open the link (`Copy`), or scan `Show QR` on a phone.

Tokens are stable across restarts; **New link** rotates the token.

## What works

- Wayland (COSMIC, Sway, Hyprland) and X11 capture via the bundled patched
  screen-relay engine.
- 1920×1080 at up to 60 fps, H.264. Internet mode goes through a Cloudflare
  quick tunnel (fresh URL each session).
- Typing into the shared desktop.

## Known limitations

- **No audio.** The stream is video only; movies are silent on the viewer.
- **No mouse control on COSMIC.** COSMIC exposes no virtual-pointer protocol;
  keyboard input works, clicks do not.
- Viewing devices need WebCodecs H.264 support (most desktop browsers do; some
  TV browsers do not).
- Home-network mode uses a self-signed certificate — one warning on the other
  device, and some TV browsers refuse it. Use Internet mode on TVs.
- One display; Linux x86_64.

## Verification

Checksum:

```
fcb2093f52c1cdd6bdeafb217658f9117aee807b795ac25fadf97da62bc64889  stable-linux-x64-ScreenShare-Setup.tar.gz
```

The engine is built from vercel-labs/screen-relay at commit `47719f1` with the
patch vendored in `engine/patch/` (see `engine/README.md`). Third-party
licenses are listed in `THIRD-PARTY.md`.
