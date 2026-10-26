# Properties for a member picked inside a group

Deep select (#1108) puts a scene id (`<group>__0__<clip>`) in the frame
selection; `inspectorOf` looked it up with `findClip` on the root doc, found
nothing, and the panel stayed empty. It now resolves the id with `scopeOf` and
returns the comp path; `FrameInspectorPanel` edits the member on
`viewOf(doc, path)` and merges back with `mergeView`. The look inspector stays
on the root doc: it edits doc-level fields `mergeView` does not carry.

Also removes 21 e2e screenshots #1108 committed at the repo root (specs
writing to an unset `SHOTS` prefix).
