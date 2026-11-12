# Inspector: a fill bound to a variable is a fill row, and it detaches

A text or shape imported from a URL carries colour variables (`Stripe/Text muted`). In Fill,
`MotionInspector` replaced the whole `FillStack` with `BindChip`: a bordered pill with its own
type, a mono hex and a `×`. Three problems followed.

- **Look.** The pill matched no other row of the inspector.
- **Detach.** `×` did call `unbindVariable`, which keeps the resolved colour, but nothing said
  so; clicking the pill opened an editor that recoloured the shared variable for every layer,
  with no way to turn this one layer into a plain fill.
- **`+` did nothing visible.** The section `+` wrote `fills` (`setProps` only refuses the bound
  key, `fill`/`color`, not `fills`), but the pill hid the stack, and the next
  `resolveVariables` dropped `fills` again (`ownedFill`), so the added fill vanished.

Now `FillStack` takes a `bound` prop and draws the bound fill as its normal row: same swatch,
the variable name in place of the hex (truncated, full name in `title`), a link icon before
the resolved hex, a detach button where remove sits. The swatch opens the side popover with
Detach and the other colour variables. Every fill write from the inspector (`+`, `commitFills`)
goes through `freeFill` first, so adding or editing a bound fill unbinds and edits in one
commit, one undo step. `freeFill` lives in `variables.ts` next to `unbindVariable`.

Discarded: letting `+` add a fill on top of a bound one. The model has one bound key per fill
stack (`fillTarget`) and resolution replaces the stack with that colour, so a second fill
cannot coexist with the binding.

Paint styles (`paintStyleRef`) are not touched: they copy their fills into the layer and are
detached from the Style section, so their fill rows were already plain.
