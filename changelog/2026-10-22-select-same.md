# Select same fill, stroke, font, effect

Figma's "Select matching" family. `sameLayers` in `select-matching.ts` reads one
key per property from a single table (`SAME_KEY`): fills (or the text colour
when no fills), strokes, font family, effect kinds. A layer without the property
matches nothing. Wired as four commands through `PICKS` in
`frame-inspector.ts`, shown in the element context menu. No shortcuts (Figma has
none).
