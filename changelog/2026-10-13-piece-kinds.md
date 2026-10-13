# A script has a kind: not every video is a launch film

**Before.** `write_script` only knew the launch film: research with sources from the site, the
acts problem → solution → proof → claim, a messy "before" screen, a sourced number. A
kinetic-typography quote (versus run1, `quote`) was refused, and the director answered with a
storyboard table instead of a video. Even with a script, the gate asked every video for the
real product UI and the four story markers.

**Now.** `PieceKind` (`src/lib/motion/script.ts`): launch, showcase, promo, event, quote,
kinetic, abstract. One table, `PIECES`, says per kind which acts it tells, whether it needs
research and sources, whether it needs words on screen, whether it shows a product. Launch
keeps everything it had; the others tell open → build → peak → close with no research.
The same kind decides:

- who builds after the script (`studio-roster.ts` `BUILDS`): a product piece goes to the
  shot builder, the others to the builder with every tool;
- which gate checks apply (`direction.ts` `PIECE_SKIPS`, aligned with PR #480's `Piece`):
  no product UI, app share, story markers or screenshot ban for a quote or a promo;
  `showcase` may show the attached screenshots.

Scripts saved before the field read as launch (`kindOf`).

**Discarded.** Mapping a quote onto the launch acts ("problem = opening"): names that lie.
