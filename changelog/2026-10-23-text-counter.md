# Counter on text clips

Jitter-parity TX-19. A number reveal ($1,200, 42%) was only possible in the UI-kit scenes.

- `props.counter` on `Text` (managed prop, `text-counter.ts`): from, to, format (plain, grouped,
  currency, percent, compact), decimals, start/duration in frames, ease (house eases only,
  `EASE_IDS`). Pure `counterAt(counter, frame)` and `formatCounter`.
- GPU: `propsAt` in `gpu-full/display-list.ts` swaps `text` per frame via `counted`.
- Export: the first frame is baked into the HTML, `hyperframes/counter.ts` rewrites the text on
  every seek (same driver pattern as text paths). `formatCounter` and `sampleTrack` are
  stringified into the page, so both stay free of module-level references.
- Properties: Counter section (`TextCounterSection.svelte`) in Animate. MCP: `set_text_counter`
  (`counter: null` removes it). `props.counter` also works through `set_props`.

A counter replaces the text, so it is refused on a clip with styled ranges. Animators on a
counting clip are not combined in export (the text node is rewritten); not guarded yet.
