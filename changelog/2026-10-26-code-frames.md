# Code frames: React and Svelte on the canvas

The `iframe` node gains a third source, `code`: `data.framework`
(`react` | `svelte`) and `data.files` (path → source). Which source a row is
still comes from which field is full (`sourceOf`): files beat html beat url.

Compilation happens inside the sandboxed iframe, not in the app: the srcdoc
built by `codeFrameHtml` (`src/lib/canvas/code-frame.ts`) loads sucrase or
the Svelte compiler and es-module-lexer from esm.sh, compiles each file to a
blob module, rewrites relative imports to those blobs and bare imports to
esm.sh with React/Svelte external (pinned in an import map). So no compiler
enters the app bundle, compilers load only when a code frame is on screen,
and a compiler crash stays in the frame. Rejected: esbuild-wasm in the app
(10 MB, and a crash would be ours).

Code frames visible on screen are DOM tiles on gpu-core (`liveCode` in
`GpuFlow`), so they run without being selected. In code mode the page is not
scaled to 1280: the frame width is the viewport, so resizing shows the
responsive layout.

The iframe schema now accepts `html` (the field the tile reads) and an empty
`url`; `frameOf` also reads the legacy `content`. The add bar shows the node
again as "Code frame", born as a React starter.

Known gaps: HashRouter/BrowserRouter fail in srcdoc (no URL origin), so
MemoryRouter is the documented path; `<base href="about:srcdoc">` keeps hash
links in the frame. Code frames have no output port: motion frames cannot
take them and there is no video export.
