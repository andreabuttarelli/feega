# A Stack around one text selects itself, not its text

Defect (production): after Wrap with stack on a free text, selecting the Stack — Layers row,
click on the canvas, Esc from the text — picked the Text; both rows were highlighted and the
right bar showed the Text's properties, so the Stack's fill, stroke, radius, clip and effects
looked missing.

Causes:

- **Own clip was `doc.tracks[0].clips[0]`.** Selecting a free element auto-picks its own clip.
  `wrapped` puts the Stack on a new lane after the text's track, so the first clip of the
  first track was the text. `ownClipOf` (`frame-select.ts`) now reads the first root clip.
- **The full-frame page rule (#1586) applied to elements.** A Stack node hugs its Stack, so
  the Stack spans the element doc and holds children: `framePage` called it the page and
  `parentPick` skipped it, so Esc from the text never reached the Stack. The chrome table now
  declares `root: Root` per frame kind (`Page` for frames and groups, `Own` for elements,
  replacing `selectsOwnClip`); `framePage(doc, Root.Own)` has no page.
- **Layers lit the element row whenever anything inside was picked.** The element row now
  carries `own` (its root clip) and is picked only when that clip, or nothing, is picked.
  Clicking it while the text is picked selects the Stack.

Inspector, renderer and codegen already treated a Stack as a Shape (ADR 0027): Fill, Stroke,
Appearance (radius, clip content, opacity, blend) and Effects show, and export paints
background, radius, `overflow: hidden` and `box-shadow` on the flex box. Tests now hold that:
`stack-inspector-render.test.ts`, `stack-visuals.test.ts`.

Guards: `stack-select.test.ts`, `layers.test.ts` (the double highlight),
`tests/e2e/canvas-stack-select.spec.ts` (Layers, canvas, Esc, then fill, radius, padding, clip,
shadow).
