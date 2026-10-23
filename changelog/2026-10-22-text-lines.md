# Text lines: units, max lines, wrap, leading trim

Roadmap W1-D, rows TX-04, TX-05, TX-07, TX-08 (letter spacing units too).

- `lineHeight` (`auto` | `24px` | `120%`) and `letterSpacing` (`2px` | `5%`) are strings on
  Text; empty keeps `leading`/`tracking`, so old docs and keyframes are untouched.
  `type-units.ts` is the one resolver painter, export and inline editor share.
- `maxLines` acts with `truncate`; truncate with 0 in a fixed box cuts at the lines that fit.
  A truncating text no longer shrinks to fit. Ellipsis replaces the tail of the last line.
- `textWrap` balance: binary search for the narrowest room with the same line count (≤6
  lines, like Chrome). Pretty: narrows until the last line has two words, never adding a line.
  Chrome's own pretty heuristic differs in edge cases.
- `leadingTrim: cap` cuts from cap height (top of `H`) to the last baseline; export uses
  `text-box: trim-both cap alphabetic`.
- Auto line height reads the font line gap (fontkit faces).
- Rust core still bypassed for any of these (`coreTypography`).
