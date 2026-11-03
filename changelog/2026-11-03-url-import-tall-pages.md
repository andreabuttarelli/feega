# URL import of linear.app and stripe.com lands, and a failed import leaves nothing

From the import audit (round 2): both sites failed after 107–143 s with 422
`comps.<id>.tracks.0.clips.N.transform.y: Too big: expected number to be <=2`, and left an
orphan page frame with grey placeholders on the canvas.

- **Cause.** A component set frame is small (a card, 200 px); its mains are copied in from the
  page with `reframed`, which keeps pixels. An instance nested in a main (the button in a card)
  is a Precomp clip whose `transform` is its offset from the nested main. Two defects:
  - `reframed` moved a clip's `transform` only when the clip had no parent, so an instance
    inside a card shape stayed where the card was on the page (3 600 px down) while the card
    moved to the set.
  - the nested main stayed at its page position, so the offset from it, in units of a 200 px
    frame, ran to ±18, past the schema's ±2.
- **Fix.** `reframed` moves a transform whenever the clip is not carried by its parent (same rule
  as `props`). `setDoc` moves every nested comp to the frame's corner and subtracts each comp's
  move from the instances that point at it, so positions stay and offsets stay within one frame.
- **Atomic import.** `landPlan` parses every doc (page and sets, ~100 ms on linear) before writing
  anything, so a refused doc creates neither a frame nor the Components page; if a write fails
  after the page frame landed, every frame already placed is removed.
- **Breakpoint copies.** Clip copies made for a breakpoint view are `tablet:<id>`; the engine
  passed `#kf-tablet:<id>` to `querySelectorAll`, which reads `:<id>` as a pseudo-class and
  threw in the responsive player. A target made only of `#id` / `.class` parts now resolves with
  `getElementById` / `getElementsByClassName`; anything else still goes to `querySelectorAll`.
- Tests: `comp-frame.test.ts` (instance inside a shape), `component-sheet.test.ts` (tall page,
  every frame of linear/stripe/vercel parses), `import-url.test.ts` (rollback, refusal before
  writing), `engine/targets.test.ts`.
