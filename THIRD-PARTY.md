# Third-party components

This app bundles or links third-party components. Their licenses apply to those
parts; the app's own code is covered by `LICENSE`.

| Component | License | Source |
|---|---|---|
| screen-relay engine + viewer (patched) | Apache-2.0 | https://github.com/vercel-labs/screen-relay |
| cloudflared | Apache-2.0 | https://github.com/cloudflare/cloudflared |
| Electrobun | MIT | https://github.com/blackboardsh/electrobun |
| Bun runtime (shipped inside Electrobun bundles) | MIT | https://github.com/oven-sh/bun |
| WebKitGTK (system package) | LGPL-2.1+ | https://webkitgtk.org |
| x264 (linked into the engine) | GPL-2.0 | https://www.videolan.org/developers/x264.html |

Notes:

- `relay-engine` is built from the pinned upstream commit with the patch in
  `engine/patch/` (see `engine/README.md`). Apache-2.0 requires keeping the
  upstream license and stating modifications — both are satisfied by that
  document and the upstream `LICENSE` in the engine checkout.
- `cloudflared` is redistributed unmodified as a separate executable.
- x264 is GPL-2.0. If you redistribute the app publicly, verify GPL
  compliance for the combined work (linking x264 into the engine makes the
  engine GPL; the viewer and app are separate). For a fully permissive build,
  the engine would need a different H.264 encoder or a GPL-compatible license
  decision.
