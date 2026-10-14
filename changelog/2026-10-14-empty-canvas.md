# Empty canvas: the first moment

A new canvas was a blank dot grid: nothing said where to start.

Now, while a canvas has no nodes and no inline frame editor is open
(`showsEmptyState` in `src/lib/canvas/empty-canvas.ts`), `EmptyCanvas.svelte` sits in the centre
with four actions, one table (`EMPTY_ACTIONS`) and one dispatch (`EMPTY_STARTS` in the canvas page):

- **Describe what you want to make…** → `requestChat()` bumps `chatOpenRequest`; the project
  layout opens the chat panel (mobile: the chat view) and the page focuses `#chat-composer-input`.
- **Frame from a template** → sets `frameLibraryAt`, the same state the add bar's Frame templates
  entry sets, so the existing `ComponentLibrary` → `addFrame` → `frame_template` action runs.
- **Generate an image / a video** → the page's `create('image' | 'video', origin)`, the add bar's
  own path (`create` action, `newNodeRow`).

It vanishes on the first node because visibility derives from `nodes.length`.

Discarded: a dedicated prompt field inside the empty state. The chat already owns prompting;
a second composer would split where the conversation lives.
