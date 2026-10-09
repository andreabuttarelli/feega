# Declared bleed, and house defaults that yield

Root cause of the Pinterest run's weak adherence: the `out-of-frame` gate fired four times ("shrink
it (zoom, width)") on the edge-bleeding type the references had, and the agent shrank it. House
rules (title cards, little text, Inter Tight 600, minimal) pushed the same way.

- Clip flag `bleed` (doc schema, `setClipFlags`, `set_visibility bleed`, read back in
  `get_motion_doc`, parity table): `outOfFrame` skips a declared bleed. The gate message now says
  how to declare one.
- Title/Text size ceiling `POSTER_TYPE_MAX` 1.2 of the short side (was 0.4): a bleeding "57" needs
  it.
- `HOUSE_DEFAULTS` (`style.ts`): `text-over-scene`, `too-much-text`, `title-type`, `crowded`.
  `HOUSE_DEFAULTS_RULE` in every prompt: they, the house face and the minimal look yield to an asked
  look or references (then `set_style graphic`); readable text, no accidental clipping and the
  intact logo stay hard. The graphic style forbids none of them (tested).
- Fonts: the full Google catalogue was already usable through `set_font`; the graphic rules now
  name condensed grotesks (Archivo Narrow/Black, Anton, Oswald, Bebas Neue).
- Discarded: skipping the safe-area check for the whole graphic style — a declared bleed per clip
  keeps accidental clipping caught.
