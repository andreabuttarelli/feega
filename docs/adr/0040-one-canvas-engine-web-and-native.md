# 0040 — One canvas engine in Rust, a web host and a native host

Status: proposed 2026-11-18. Amends ADR 0021 (the desktop canvas is no longer the web canvas
under a native renderer) and ADR 0020 point 4 (hit-testing leaves TS). Extends ADR 0037 from
"camera, culling, overlay" to everything spatially tied to the canvas. Reverses, for the canvas
path only, the October choice to keep doc → display list in TypeScript. Plan and stage table:
[`docs/specs/one-canvas-plan.md`](../specs/one-canvas-plan.md).

## Context

The owner wants the desktop app to carry more weight without a second codebase: **one canvas**
that runs on the web through WebGPU/WebGL (wasm) and on the desktop through Metal / DX12 /
Vulkan (wgpu, native threads), not inside Chromium's compositor. Everything else in the desktop
app stays the existing web UI in Electron.

What exists today, verified on `dev` 926e49c:

| Piece | Where | Language | Size |
|---|---|---|---|
| Renderer: tiles, layers, pictures, text as contours, export | `packages/gpu-core` | Rust | 12.6k lines |
| Per-frame policy (tile / direct / held path, warmup, pyramid, budgets) | `gpu-core/src/web.rs` | Rust, wasm-only | 1.47k |
| Shaping, metrics, outlines, line setting (HarfRust, skrifa, Parley) | `packages/gpu-text` | Rust | 1.0k |
| Doc → display list (`prepare`, `drawFrame`) and its transitive imports | `motion-core/src/motion/gpu-full` + closure | TS | ~41k lines, 271 files (esbuild closure; a canvas-path subset is smaller) |
| Text faces | fontkit by default; `?faces=rust` already runs gpu-text through `TextCore` | TS / Rust | — |
| Canvas runtime: frame sources, build worker, picture uploads, cards, overlay, hit-test, spatial index, inertia, caret | `src/lib/canvas/core/` | TS | 6.2k |
| Canvas components | `CoreFrames.svelte` 1.7k, `GpuFlow.svelte` 5.4k | Svelte | 7.1k |
| Desktop native spike (macOS, napi, dev-only) | `apps/desktop/native/` | Rust | 0.8k, re-implements a subset of `web.rs` |

Two measured facts frame the decision:

- **The main thread is the wall.** On load and in some gestures the time goes to source JSON,
  layout, Svelte and GC, not to the GPU. Handing source text straight to the build worker cut
  all-vectors on a 36-page canvas from 7.2 to 5.6 s. ADR 0035 showed render count is not the
  bottleneck.
- **The spike failed on the seam, not on the renderer.** The native NSView sat behind a
  transparent page; overlay, selection and inputs were DOM tracking a camera that lived across an
  async IPC hop (page → main → addon). It drifted, stuttered on gestures and was pulled from the
  release on 11-11 (ab66bf673). Its renderer half had also forked from `web.rs` (108 commits on
  `web.rs` vs 4 on the spike since 10-26).

ADR 0037 step 1a (overlay in the engine) was stopped by its stop rule on the web: −19 ms per 4 s
zoom, inside noise. So moving the overlay into Rust is **not** a web speed win today. It is the
condition for a native canvas that does not drift, and that is the reason it comes back here.

## Decision

### One crate owns the canvas: `canvas-engine`

A new Rust crate, `packages/canvas-engine`, owns everything spatially tied to the canvas. It
depends on `gpu-core` (draws display lists to a wgpu surface) and `gpu-text` (shapes and
measures). It never depends on a host.

| Owns | Today in |
|---|---|
| Scene: doc → display list for the canvas path (layout, auto layout, responsive views, components, animated values at a time, text setting) | `motion-core` `prepare`/`drawFrame`, TS |
| Text shaping and measuring | fontkit (TS) / gpu-text |
| Frame, picture and font scheduling and caches; tiles and levels; per-frame policy and budgets | `frame-sources.ts`, `frame-cache.ts`, `CoreFrames.svelte`, `web.rs` |
| Camera, gestures, inertia, culling (one spatial index) | `GpuFlow.svelte`, `inertia.ts`, `spatial-index.ts`, `world.rs` |
| Hit-testing against what it drew | `camera.ts`, `geometry.ts`, `gesture.ts` |
| Everything drawn over the canvas: selection, handles, hover and pick outlines, names and labels, guides and gaps, marquee, peers' cursors, drop indicators, the text caret, text selection and IME composition underline | DOM components and `world-overlay.ts` |

`gpu-core` stays the renderer and keeps the server binaries (`gpu-core-render`,
`gpu-core-export`); `web.rs`'s policy moves up into `canvas-engine`, and `web.rs` shrinks to
the wasm surface glue.

### A small platform trait, two hosts

`canvas-engine` reaches the outside world only through one trait, `Platform`, with exactly two
implementations (so the rule against single-implementation interfaces holds):

| Capability | Web host | Native host |
|---|---|---|
| Surface and GPU device | `HtmlCanvasElement` / `OffscreenCanvas`, WebGPU, WebGL2 fallback | raw-window-handle of a child view, wgpu on Metal / DX12 / Vulkan |
| Clock and vsync | `requestAnimationFrame` | display link (`CVDisplayLink`, DXGI wait, presentation feedback) |
| Input | pointer, wheel, gesture events forwarded from the page | the child view's own mouse, trackpad, scroll and magnify events |
| File and network fetch | `fetch` | HTTP client with the session's bearer |
| Image and font decoding | `createImageBitmap`, font bytes | ImageIO / WIC / image crate; system fonts |
| Storage | IndexedDB | app data directory |
| Threads | web workers (frame build pool) | OS threads |

The **web host** is wasm plus a thin JS shell that forwards raw input and hosts the DOM UI. The
**native host** is a Rust library loaded by Electron's main process (napi), owning a child view
inside the Electron window, its render thread and its worker threads.

### What stays in TypeScript and the DOM

Everything not spatially tied to the canvas: panels, inspector, layers list, chat, toolbars,
menus, dialogs, toasts, settings, auth, billing. Also stays in TS: **the document and its ops**
(ADR 0029's optimistic runner, `REGISTRY`, undo, realtime, saving), the API, CLI and MCP, code
export. The engine holds a read replica of the canvas, never the source of truth for edits.

### One command and event API, same on both hosts

- **Commands in** (DOM → engine): document deltas (node upsert / patch / delete, connection
  changes, doc source text for a frame), selection, tool, theme tokens (resolved from DESIGN.md
  in TS, sent as numbers and colours, as in 0037), viewport rect, "focus node", "fit". Frames
  the engine cannot build (Custom components, Device3D, embeds, React videos — they need a
  browser, ADR 0019) arrive as ready display lists built by the page's DOM reader.
- **Events out** (engine → DOM): intents — "move these ids by dx, dy", "resize to box", "select
  ids", "open text edit at id", "drop asset at point" — which the DOM turns into optimistic ops;
  plus camera changes (throttled), hover and selection changes, `rect_of(id)` answers, and frame
  stats.
- **During a gesture the engine shows the result itself**; only the intent at the end crosses the
  boundary. Nothing in the DOM has to follow the canvas while it moves, on either host.

On the web the API is wasm calls (or `postMessage` once the engine lives in a worker). On the
desktop it is IPC: the renderer calls a preload bridge, the main process forwards to the addon.
Both are asynchronous-tolerant by construction: no command or event is on the path of a frame.

### Desktop: Electron UI, native canvas surface — the compositor seam

This is the central risk and the reason the spike failed. Four rules:

1. **The engine draws everything spatially tied to the canvas** (table above). No DOM element
   tracks the camera during a gesture. This is what removes drift, not faster IPC.
2. **The canvas owns input on its surface.** The child view receives mouse, trackpad, scroll
   and magnify events directly into the engine thread; the camera moves without leaving native
   code. Keyboard focus stays in the page: shortcuts and menus are DOM, and they send commands.
3. **Placement, DPR, occlusion.**
   - The page measures the canvas slot (`ResizeObserver`) and sends its rect in CSS px; the main
     process converts with `webContents.getZoomFactor()` and places the view. The view reads its
     own backing scale (`backingScaleFactor`, per-monitor DPI) — DPR never travels from the page.
   - Panel resizes snap (no CSS transition on the canvas slot), so the one-frame placement lag
     is never animated; a backdrop in the canvas colour covers the gap, as the spike did.
   - **Occlusion: the canvas view sits above the web view and is lowered under it while a DOM
     layer overlaps its rect.** The page keeps the canvas slot transparent. Each popover, menu,
     dialog and toast that can overlap the canvas registers itself (one registry in TS, not a
     check per component); while any is open, the host orders the canvas view below the
     transparent web view, so the DOM layer appears above a still-rendering canvas, and input
     over the canvas goes to the page — correct for modal layers, which close on an outside click.
     On close the view is raised after the DOM commit. Native context menus (`Menu.popup`) are
     windows and need nothing.

   Considered for the seam:

   | Option | Verdict |
   |---|---|
   | Canvas view always **below** a transparent page, input forwarded page → IPC → main → addon (the spike) | Rejected: input and camera cross an async hop on every event. |
   | **Child view above, lowered under open DOM layers** | **Chosen.** Input native, DOM layering correct, works on Electron 38. Costs one reorder per popover open/close. |
   | Popovers in a second transparent `WebContentsView` above the canvas | Rejected: splits the Svelte app across two renderers and two stores. |
   | **Shared texture into Chromium's compositor**: the engine renders to an IOSurface / NT handle / dmabuf; Electron's `sharedTexture.importSharedTexture` + `sendSharedTexture` hands a `VideoFrame` to the page, drawn in a WebGPU canvas | Fallback, measured in S4. Layering, DPR and occlusion come free from Chromium, but input enters the page again (one hop, through a `MessagePort` to the engine) and every frame crosses main → renderer. **Not available on Electron 38.2.0** (our pin: its typings have only offscreen-rendering `OffscreenSharedTexture`, i.e. web contents *out* to a texture). The import module landed in electron#48831 (Nov 2025) and is documented as experimental in the 40.x line; using it means an Electron upgrade first. |
   | Offscreen-render the whole web UI (`webPreferences.offscreen.useSharedTexture`) and composite it in a native window | Rejected: input, IME and accessibility of the UI would all go through `sendInputEvent`. |

4. **IME and text editing on a native surface.** The engine draws the text, caret, selection and
   composition underline. The keyboard and IME stay in the page, on both hosts: a hidden
   `textarea` placed at the caret rect the engine reports (`rect_of`) receives keys and
   composition, so the OS candidate window sits at the caret; the page sends edits as commands
   and the engine redraws. One model for both hosts, no `NSTextInputClient` / TSF / IBus code in
   v1. Each keystroke costs one IPC hop on the desktop; nothing spatial waits on it. A native text
   input client comes only if S4 measures key-to-glyph latency over one frame or finds IME bugs.

Accessibility follows 0037: the engine draws, the DOM describes (an offscreen, ARIA-labelled
list of selected and focused nodes stays in Svelte), the same on both hosts.

### One source of truth for document semantics, shared with the server

Two options were weighed:

| | (1) Port layout/text to Rust, call it from Node too (napi / wasm) | (2) Keep TS as truth, lock the Rust port to it with a byte-equality corpus |
|---|---|---|
| Truth | one implementation | two implementations, one authoritative |
| Server paths (video/still render, export, API/MCP) | must switch to the Rust scene; Node gains a native or wasm dependency on every server path | unchanged |
| Risk | a big-bang switch of the render server; codegen and ops still read TS types, so the doc schema lives in both | permanent double maintenance; the corpus only catches what it covers |
| Change cost during the port | motion-core feature work must land in Rust | every canvas-path change lands twice |

**Recommendation: (2) during the port, (1) at the end, for layout and text only.**

- The doc **schema and ops** stay TypeScript forever: the API, CLI, MCP, the optimistic runner and
  code export read and write the doc, they do not lay it out. Rust reads the doc through serde
  types generated from (or checked against) the TS types.
- **Doc → display list** (layout, text setting, animated values) is ported to Rust behind a
  corpus: real-site documents (`landings.feega`: vercel, stripe, supabase, linear; desktop,
  tablet, mobile views) plus the motion-core unit fixtures, compared as packed display-list wire
  with a fixed rounding (`js_round`), byte for byte. CI fails on any difference. While both exist,
  **motion-core is locked, not frozen**: a change to a canvas-path module lands with its Rust
  counterpart in the same PR, or not at all.
- When the Rust scene covers the whole corpus, the server's still and video render (already
  `gpu-core-export` for the GPU path) calls it through napi, and the TS `prepare`/`drawFrame`
  canvas path is deleted — one implementation again. Anything the canvas never draws natively
  (Custom/Device3D, hyperframes, rendercomp) stays TS and reaches the engine as a display list.

Option (1) up front was rejected because it rewrites the render server before the canvas has
proved the port. Option (2) as an end state was rejected because two layout engines drift the
moment the corpus misses a case — the spike's fork of `web.rs` is the proof.

## Consequences and risks

- **Text shaping parity.** fontkit (default) and gpu-text shape differently in edge cases (kerning
  tables, variable axes, fallback). The port first makes `?faces=rust` the default on the web —
  measured and screenshot-compared — so the engine inherits a shaper the product already uses.
- **The lock on motion-core** slows feature work on layout and text for the port's duration. The
  corpus makes the cost visible per PR rather than at the end.
- **Two-host input semantics.** Trackpad pinch, momentum scroll and wheel deltas differ between
  browser events and native events. Gesture math lives once in the engine, fed a normalised
  event (kind enum, position, delta, modifiers, phase, timestamp); each host owns only the
  normalisation, with recorded event traces as test fixtures.
- **IME** stays in the DOM in v1 (above). CJK and dead-key tests go into S4's exit criteria.
- **Accessibility** depends on the DOM description staying in step with what the engine draws.
- **Electron upgrade** becomes necessary only if the shared-texture fallback is chosen.
- **Team velocity.** The plan is roughly 40–57 engineer-weeks (judgement, stage table in the
  plan). Each stage ships alone and has a stop rule; the canvas is never left half-moved between
  two runtimes for more than one stage.
- **Stop rule** (0035, 0037): a stage that does not move its measure beyond the run-to-run range
  stops, and the number is written here.
