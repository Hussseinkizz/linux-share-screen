# Third-party components

This project is distributed under GPL-2.0 (see `LICENSE`). Third-party
components keep their own licenses; the app aggregates the engine as a
separate program rather than re-licensing it.

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
- The engine links x264 (GPL-2.0), which is compatible with this project's
  GPL-2.0 license. The patched engine source is reproducible from
  `engine/patch/` plus the pinned upstream commit, satisfying the source
  requirement for binaries we distribute.
