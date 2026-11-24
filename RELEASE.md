# Releasing

Manual release process. No continuous integration is used.

## What the artifact contains

- `relay-engine`: patched screen-relay engine with COSMIC capture support.
- `viewer/`: the web viewer served by the engine.
- `cloudflared`: tunnel client for internet mode.
- the Bun runtime and native WebView wrapper from Electrobun.

End users install the app and press Share. They do not install the
screen-relay CLI, a package manager, a tunnel client, or anything that needs
administrator rights.

## System dependencies

GTK 3 and WebKitGTK 4.1 are required at runtime. Both ship with current desktop
installs. A `.deb` or an AppImage with bundled WebKit would remove this
requirement; that work is not done yet.

Home network mode also uses `openssl`.

## Build

```sh
bun install
bun run fetch:cloudflared
bun scripts/bootstrap-engine.sh
bun run package
```

`resources/` is not committed. The binaries above produce it from the pinned
engine source and the viewer in the engine checkout.

## Cut a release

```sh
bun run release 1.0.1
```

This script:

1. checks the tree is clean and on `main`;
2. updates the version in `package.json`, `electrobun.config.ts`, and
   `src/shared/version.ts`;
3. typechecks and builds the installer archive and AppImage;
4. commits, tags, and pushes `main` and the tag;
5. creates the GitHub release with the installer, AppImage, update manifest,
   and checksum in the release notes.

## Manual fallback

```sh
bun run package
gh release create v1.0.1 \
  artifacts/stable-linux-x64-ScreenShare-Setup.tar.gz \
  artifacts/Linux-Screen-Share-x86_64.AppImage \
  artifacts/stable-linux-x64-update.json \
  --title "Linux Screen Share v1.0.1" \
  --notes-file RELEASE_NOTES.template.md
```

## Repository contents

The engine patch and pinned bootstrap script make the binary reproducible from
this repository. Source completeness for the GPL linked encoder is satisfied by
that patch plus the pinned upstream commit.
