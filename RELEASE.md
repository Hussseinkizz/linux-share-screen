# Releasing

What "installed and it works" means today, and what each build step produces.

## What the artifact contains

The packaged app bundles:

- `relay-engine` — patched screen-relay engine (COSMIC capture support).
- `viewer/` — the web viewer served by the engine.
- `cloudflared` — tunnel client for Internet mode.
- the Bun runtime and the native WebKit wrapper from Electrobun.

End users install the app and click Share. They do **not** install pnpm, the
screen-relay CLI, Caddy, cloudflared, or run anything with sudo.

## System dependencies (declared, not bundled)

- `libwebkit2gtk-4.1-0` (Electrobun's Linux webview) and normal GTK/X11
  runtime libraries. A `.deb` declares these; the desktop installs them.
- For **Home network** mode only: `openssl` (present on mainstream distros).
- Internet mode needs outbound internet; Home-network mode does not.

## Build locally

```sh
bun install
bun run fetch:cloudflared          # once (or pin CLOUDFLARED_VERSION=…)
SCREEN_RELAY_REPO=… bun scripts/bootstrap-engine.sh   # if relay-engine is missing
bun run build                      # dist/ + electrobun build artifacts/
```

`resources/` is gitignored: binaries are produced by the steps above and are
not committed.

## Cutting a release

```sh
git tag v1.0.0
git push origin v1.0.0
gh release create v1.0.0 artifacts/… --title "v1.0.0" --notes-file RELEASE_NOTES.md
```

## Honest status of automation

- The repository contains `engine/patch/` plus `scripts/bootstrap-engine.sh`,
  so a clean machine can reproduce the exact engine from the pinned upstream
  commit. That is the source-completeness requirement for the GPL-linked x264
  and Apache-2.0 upstream.
- A GitHub Actions workflow is provided (`.github/workflows/release.yml`), but
  it has not been executed yet on GitHub; its apt package list for
  WebKitGTK/Electrobun is best-effort until the first run.
- The first release artifact is built on the maintainer machine.

## Known gaps before a frictionless public v1

1. **Installer polish:** `.deb` produced by this repo; AppImage (which would
   also bundle WebKitGTK) is not set up yet.
2. **Audio:** video only (ADR-014). Movies are silent on the viewing device.
3. **TV codecs:** viewers need WebCodecs H.264; MSE fallback is phase 5.
4. **COSMIC:** viewing + typing only (no pointer injection).
5. **Quick tunnel URLs** are random per session; named tunnels/custom domains
   are future work.
6. **CI** must be validated on the first GitHub run.
