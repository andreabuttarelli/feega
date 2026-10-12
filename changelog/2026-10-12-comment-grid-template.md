# Comment grid motion template

Ninth hand-made template: columns of comment cards (initials avatar or picked picture, name, handle, stars, text) fill the frame, enter from the centre out (pure in-out expo fade + rise), drift vertically, then the title enters with the shared word entrance while a radial veil and a 2px blur dim the grid.

- **Comments are one textarea**, `Name | @handle | comment | stars | time` per line: editable anywhere, no list editor needed. Not a runtime variable: the var schema caps strings at 500 chars.
- **Seamless drift**: each column's cycle is extended until it is taller than the frame plus one card, and travels a whole number of cycles per loop; wraps happen out of frame (tested). Different cycle heights give each column its own speed.
- **Heights are measured in the DOM** and passed to a pure model, so layout tests run on fake heights.
- **Theme** is a select (light, dark, custom); the colour fields only apply to custom — one table in CSS, no per-colour conditions.
- Card radius defaults to 4% of the card width: user content, deliberately not the app's sharp-corner rule.
- Loop is 12 s, not 10: each column must travel whole cycles, so a longer loop is the only way to a calmer drift.
- Fields grouped Text, Media, Style, Cards, Focus (dim/blur under the title), Motion.
- Library preview uses the default initials avatars: no sample photos needed.
