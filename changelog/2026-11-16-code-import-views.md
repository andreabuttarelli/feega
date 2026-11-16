# Code import: widths of one page are breakpoint views

One page imported at several widths of one theme used to land as one board per width, with nothing
linking them. It now lands as one frame: the widest capture is the base, the narrower ones are
breakpoint views, merged by the URL importer's `withViews` (`code-views.ts`). Same layer, per-view
overrides.

Decisions:
- Components vs views: ADR 0022 says an instance cannot follow a view. Options were instance
  overrides on the box only (freezes the inside at desktop, and the pairing never pairs instance
  clips), a model change (not in this PR), or an explicit exclusive choice. Took the choice:
  `responsive: views | boards`, default views, components listed in `skipped`.
- Dark is not a view. Several pages or themes in one run stay boards, with a note in `skipped`.
- Write-back: a view edit is refused (`view-look.ts` baselines each view in `source.was`), never
  written as a base style. `into` is refused on a frame with views. Pull reads `view` in the map.

Tests: `code-views.test.ts`, `code-views.browser.test.ts` (per-view fidelity, before/after).
