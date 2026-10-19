# New elements pivot from their top-left corner

The anchor (origin of rotation and scale) of a new element was the centre of its box, by absence:
`TRANSFORM.anchorX/anchorY.fallback` is 0.5 and `pivotOf` reads it, so the HTML compose
(`transform-origin`), the gpu scene (reads that `transform-origin`) and every selection/parent
computation agree on it.

Now the entry points that create an element hand `addClip` an explicit `transform: TOP_LEFT_ANCHOR`
(`anchorX: 0, anchorY: 0`): drawing in a frame and on the free canvas (`draw-create`), the editor
add menu, and the agent tools `add_clip` and `add_shape`. The inspector anchor widget already read
the stored value, so it shows top-left selected for them. `isAnimated` ignores anchor-only
transforms so these clips keep their plain markup until something really moves.

Discarded: changing the fallback or `newClip`. Saved documents carry no anchor and would move, and
templates, UI-kit clips (`focus_ui` zooms from the centre pivot, the top-left one runs out of `x`
range), shots and precomps assume the centre. Existing documents and those builders are untouched;
the compose test pins both a saved rotated clip (centre) and a new one (top-left).
