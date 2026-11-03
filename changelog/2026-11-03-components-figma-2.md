# Components, round two: adding into mains, variants, paste, nested overrides

Follows `2026-11-03-components-figma.md` (case studies mobile B2, B5, M2, M3, M6; landing
#16; nested instances).

**Adding into a main (B2).** `into-main.ts`: `mainUnder` finds the smallest main (role Main
here) whose content box holds a point; `landInside` moves a clip and its subtree into the
main's comp (shifted by the host transform, timed to the host) and joins the stack under
the point; `dropIntoMain` only acts over a main. Wired in three places in GpuFlow: drawing
on the canvas into a frame or a Components-page set (`frameUnderDrawing` now accepts an
element holding a main under the anchor), drawing with the frame entered (`drawnInside`,
second history entry "Added to the main component") and a canvas drag dropped on a main.
Layers drag into a main row is not wired.

**Change to (B5).** Needed the whole set in the instance's doc; fixed by the set carrying
of round one. Pinned by a test.

**Variant leak (M2).** Not reproduced once mains edit their comp; pinned by a test.

**Variants beside (M3).** `addVariantBeside` appends a variant and places its host 20 px
right of the main. Used by the inspector's Add variant (mains only, not inside a
Components-page set, which keeps its own "+") and the canvas "+" under a picked main.
Instances no longer offer Add variant. Agent: `add-variant` with `clip_id`.

**Paste (M6, landing #16).** The copy homes its homeless mains to the source frame, so the
paste is an instance there; `merged` reframes carried comps from the source size, so the
instance keeps its pixels.

**Nested overrides.** `mergeScope` wrote an edit inside a nested instance into the
parent comp: a text on the button of one card changed the Card main. It now recurses: the
nested host's `overrides` change is merged as an edit of the outer scope, ending as
`{ nestedHost: { overrides: {...} } }` on the outermost instance (the format
`nested-overrides.ts` already used), or in the main when the outer host is a main.

Not done: Layers drag into a main; instance W/H as a frame resize (scales); the race
where a save right after ⌥⌘K overwrites the server write that homes the main (seen once:
the main stayed in the frame).
