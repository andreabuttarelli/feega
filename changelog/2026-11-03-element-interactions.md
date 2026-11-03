# Element interactions: Open URL and Add interaction

Interactions were already stored per clip (`clip.interactions`, `interactionSchema` in
`packages/motion-core/src/motion/prototype/model.ts`), so an element inside a frame could
navigate, open an overlay or change variant. Missing for an import audit: opening a web page,
adding an interaction without aiming at a frame, and a rule for who wins when an element sits
inside another linked layer.

- `ActionKind.OpenUrl` with `url`, http/https only (`javascript:` refused by the schema).
  The player keeps its state (`act` → stay) and `linkOf` hands the URL to
  `PrototypePlayer.fire`, which opens it in a new tab.
- `freshInteraction` / `relinked` in `edit.ts` back the **Add interaction** button and the URL
  field in `PrototypeSection.svelte`. A typed address without a scheme gets `https://`.
- Element-over-parent stacking: dropped my area sort on rebase; `dev` already orders hotspots
  parents before children.
- Agent: `add_interaction` already validates with `actionSchema`; its description names
  `open_url`.
- Left out: code export emits no prototype links at all today (only hover styles), so no
  `<a href>` for navigate/open URL.
