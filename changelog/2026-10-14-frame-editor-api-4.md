# Frame editor page load over the API (4/n)

A static client (ADR 0009 option d) needs the editor's load without SvelteKit. The load body
moves from `loadEditorSession(locals, …)` into `editorSession(canvasScope, …)`, which takes a
scope instead of `locals`; the page keeps calling `loadEditorSession`, which only builds the scope
and delegates. The op `editor_session {briefIds?}` calls the same function, and the parity test
compares the page `load` with the endpoint body on one fake DB.

The API path checks the node twice (once in `callerMotionScope`, once inside `editorSession`,
where it runs in parallel with the reads): one indexed read, kept so the page path stays as it was.
