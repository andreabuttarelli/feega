# References become a measured look

The v2 Pinterest run saw the pins accurately and picked `graphic`, then built type at ≤0.4 of the
frame, no bleed, no small-text columns. It called `view_frames` itself, so the self-check round that
carried the references (#368) never ran: nothing set frames next to pins.

- Every `view_frames` result now carries the last 3 reference pictures of the turn after the frames,
  with the per-frame diff ask (`framesOutput`, `REFERENCE_ASK`). `turn.ts` keeps them on
  `session.references` from `prepareStep`. `checkMessage` is plain text again: the view it asks for
  brings the pictures, sending them twice was waste.
- `set_reference_look` records `doc.referenceLook` (`reference-look-model.ts`): largest type as a
  share of frame height, bleed, columns, small-text density, palette, font class, imagery.
  `get_motion_doc` shows it.
- `lookProblems` (`reference-look.ts`) measures Title/Text/Kicker/Caption against it; misses are
  `Quality.OffLook` with a `LookMiss` effect, severities in the one `SEVERITY` table. Blocking:
  references seen with no look recorded, type under half the target, bleed asked and nothing
  bleeds, small text asked and none. Warning: type under 3/4, fewer small blocks than columns.
- Custom components are not measured (their type is in code); palette, font and imagery are
  recorded, not gated — no reliable measure yet.
- Discarded: a separate judge model comparing refs and frames; the agent holds both and must fix.
