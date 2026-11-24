# Engine patch provenance

The bundled `relay-engine` is a build of
[vercel-labs/screen-relay](https://github.com/vercel-labs/screen-relay)
(Apache-2.0) with local modifications, pinned to upstream commit
`47719f1`.

Changes in `engine/patch/` (copied over the pinned checkout by
`scripts/bootstrap-engine.sh`):

- `Makefile`, adds the two ext-image-copy-capture protocol XMLs.
- `src/engine/backends/linux/wayland/protocols/ext-image-capture-source-v1.xml`,
  `ext-image-copy-capture-v1.xml`, vendored from wayland-protocols; the
  source XML drops the unused foreign-toplevel manager interface.
- `src/engine/backends/linux/wayland/wayland.hpp`, `wayland.cpp`, bind the
  ext image-capture source and image-copy-capture managers.
- `src/engine/backends/linux/wayland/capture.cpp`, new `ExtCaptureSource`
  (ext-image-copy-capture backend, shm path), accepts ABGR/XBGR shm formats
  with an R↔B swap on damaged regions, and selects the backend when
  wlr-screencopy is unavailable (COSMIC).
- `src/engine/backends/linux/wayland/input.cpp`, virtual pointer is
  optional; pointer jobs no-op with a stderr notice when the compositor
  offers no virtual-pointer protocol.

Rebuild:

```sh
bun scripts/bootstrap-engine.sh      # clones pinned upstream + applies patch
# prints the checkout path; then:
bun run resources                     # builds viewer + copies relay-engine
```

Not patched: the X11 backend, encoder, wire protocol, viewer. The viewer is
built unmodified from the same checkout.

Licenses: screen-relay is Apache-2.0, see `THIRD-PARTY.md`.
