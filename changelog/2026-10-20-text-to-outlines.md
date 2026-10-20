# Text to outlines

Text clips (Title, Text, Kicker) become real path shapes with `text_to_path`, Cmd+Shift+O or "Outline text" in the layer menu. Glyph outlines come from the font file (opentype.js, loaded in the browser or on the server), laid out with the same maths as `measure_text`: size, tracking, leading, alignment, wrapping, `textCase`. The shape keeps the text box, so transform pivot, constraints, opacity and fills stay. One doc op, one undo step.

Dropped: keyframes on text-only props, text animators. Refused: Caption (box background), text on a path, text over 20000 chars of path data. Limits: variable-font axes (weight is the nearest static file), emoji and fallback glyphs, ligatures and complex shaping.

`textLook` moved out of `motion-tools.ts` to `text-look.ts` so the op and `measure_text` share it. `editClip` is exported from `timeline.ts` because the op swaps the clip's component.
