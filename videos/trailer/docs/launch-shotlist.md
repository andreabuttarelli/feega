# Launch trailer — shot list

Reference structure (41.9 s, cuts measured with ffmpeg scene detection at 5.25, 13.4, 16.0, 25.0,
27.3, 29.7, 34.5 s plus soft cuts every ~2.5–3 s):

| Ref | Time | Shot grammar |
|---|---|---|
| A | 0.0–3.0 | white bg, centred two-line lowercase headline, one word in a colour box popping in; pixel characters hop in a row below; scattered pixel squares |
| B | 3.0–5.3 | full-bleed colour bg, input card, cursor types |
| C | 5.3–8.0 | app UI card, small caption on top, light → dark theme swap |
| D | 8.0–11.0 | pixel landscape tiles carousel sliding left, character in each tile |
| E | 11.0–13.4 | black bg, headline left, list card right, cursor hovers rows, characters bottom-left |
| F | 13.4–16.0 | white bg, scattered pixel elements and mono micro-copy |
| G | 16.0–21.0 | headline + card, boxed word, colour-block wipe, chips card |
| H | 21.0–24.0 | colour bg, dialog card, cursor clicks a button, boxed word |
| I | 24.0–27.3 | blue bg, settings card, toggles flip one by one |
| J | 27.3–32.0 | split screen: headline left, dark app card right, colour bg wipes in |
| K | 32.0–34.5 | white bg, grid of integration tiles going "connected", boxed word |
| L | 34.5–38.0 | colour bg, boxed word headline over app card |
| M | 38.0–41.9 | logo card, tagline, URL chip, characters around |

## Reference motion (frames at 30 fps, measured on 10 fps sheets + full-rate strips at each cut)

| Ref | Motion |
|---|---|
| A | words fly in from scattered positions and settle into two lines (0–18); boxed word box pops on (≈f20); 9 creatures pop in left→right, 3 f stagger, then hop continuously; pixel squares blink/drift; exit = pixel-block dissolve sweeping left→right in the next colour (≈10 f, ragged edge) |
| B | input bar holds, cursor clicks, text types letter by letter (≈2 f/char), mascot blinks/changes face; hard cut |
| C | caption words type on; app card holds while content rows change; theme flips light→dark through horizontal black bars wiping right→left (≈6 f) |
| D | pixel-block wipe in; portrait tiles slide left as a carousel (one tile per ≈12 f), each "?" box flips to reveal a creature, next tile's colour enters from right edge |
| E | headline words stagger in (2–3 f); list card on right scrolls, cursor visits rows one by one, row highlight follows; creatures hop bottom-left |
| F | white; pixel cards fly in from all sides and converge to centre, then a card stack flips through (one card per ≈10 f) while caption words swap |
| G | card zooms in from small with pixel-dissolve reveal; headline types word by word beside it, boxed word last |
| H | solid panel slides in from right with a stair-stepped pixel edge (≈8 f); memory chips drop into a thought bubble one by one (≈3 f stagger, staggered rows) |
| I | blue; dialog pushes in (camera zoom ≈1.4×, 12 f) on the button, cursor clicks, button colour flips; boxed word pops |
| J | split screen: white panel slides from left with stepped edge; toggles flip in sequence with cursor; creatures peek over the card |
| K | staircase purple panel wipes in from right over the left half; creatures pop up one by one above the card |
| L | white; integration tiles grid, cursor travels tile to tile, each lights "connected"; boxed word types in |
| M | blue panel pixel-wipes in from top-right; logo card + tagline words stagger; creatures arrive at the sides one by one and bob |

Rules taken from it: nothing holds still longer than ≈15 f except the final card; lists are revealed and
then *visited* item by item; every section change is a coloured wipe (pixel dissolve or stepped
panel) with an occasional hard cut on the beat.

Feega version, `Launch` composition, 30 fps, 1045 frames (34.8 s). Flow: edit visually → lands in
code → templates → insert (zoom out) → team and agents edit the inserted section → plugins →
editors → frameworks → open source → end card. No eyebrow labels.

Every editor shot uses one mockup, `editor/FeegaEditor.tsx`, rebuilt from the real webview
(`inspect/src/webview/`) and the landing screenshots: Layers (+ Add) or Library on the left,
toolbar with Feega menu, history, address, device group, `1140 × 860`, Theme; preview with the
Design/Navigate bar; Properties / Changes / Comments on the right (breadcrumb, `editing: auto ·
1140px`, This element / All, State, Size, Spacing, Typography, Radius, Effects). Density reduced,
labels and colours kept.

| # | Start | Frames | Bg | Headline (boxed) | Motion | Exit |
|---|---|---|---|---|---|---|
| 1 | 0 | 84 | white | the best free / Lovable **alternative**. | words scatter in; pixel icons hop | pixel dissolve |
| 2 | 84 | 84 | orange | edit your running app **visually**. | editor rises; click h1 f30, click Fill f46 (colour popover), orange swatch f60, "Saved to Hero.svelte:14" toast | stepped panel |
| 3 | 168 | 96 | paper | every edit lands in your **code**. | editor on Changes tab (entries + inline diff); diff card slides in, lines stagger | hard cut |
| 4 | 264 | 72 | black | free and premium **templates**. | pixel-framed template carousel slides left | hard cut |
| 5 | 336 | 204 | black | collab with your / team and **agents**. | close on Library; grab Pricing f18, drag with ghost while the camera zooms out to the whole editor, drop line "after div.actions" f40, drop f54, section expands, Library closes to Layers with `section.pricing` selected; f84 editor shrinks right, Claude Code terminal slides out from behind it; headline f80; prompt "make the pricing cards 3 columns and highlight Pro" f106; thinking, diff f140; preview cards morph 2→3 columns, Pro goes dark with "popular", agent glow f152–186; teammate cursor "Maya" moves in the preview from f96 | pixel dissolve |
| 6 | 540 | 95 | white | plugins, if you / want **more**. | mesh plugin in the editor, pointer drags a point; cube | pixel dissolve |
| 7 | 635 | 100 | white | editors deck | editor windows swap (VS Code, Cursor, terminal…) | hard cut |
| 8 | 735 | 95 | white | every **framework**. | tiles flip in, sweep | stepped panel |
| 9 | 830 | 95 | orange | free and / **open source**. | star click, pixel stars | stepped panel |
| 10 | 925 | 120 | black | Feega mark + "design in your codebase." | logo, tagline, URL chip | — |

Every section pushes in 3.5 % over its length and, in its last 12 f, slides 140 px left and
shrinks 6 % under the wipe. SFX: pop on each word box, click on cursor clicks/grab/drop, whoosh on
wipes and the terminal reveal, taps on diff lines, chime when the agent finishes and on the logo.
`npm run clicks` checks every click lands inside its target.

## Music

Track: "The Classic Groove" by BOSNOW, 130 BPM, first downbeat at 0.875 s, 16-beat phrases
(one lighter bar, three full). The mp3 is not in git (`public/music/*.mp3` is ignored): copy it
locally to `public/music/classic-groove.mp3` before rendering.

1. Drop the track in `public/music/`.
2. In `src/launch/beat.ts` set `MUSIC`: `file` (name inside `public/music/`), `bpm`, `firstBeat`
   (frame of the first downbeat in the video at 30 fps), `startFrom` (seconds into the track where
   the video starts: 2.72 s, the first full bar), `volume`, `fadeOut` (frames), `sfxDuck` (SFX
   gain while music plays).
3. Render. Scene boundaries, boxed-word pops and the editor flips snap to the nearest beat; the
   total snaps to a beat too. Scene lengths are whole beats (13.85 frames): Code, Collab, Plugins
   and the end card start on bars; the video is 21 bars (1163 frames).
4. Master to -14 LUFS, true peak <= -1 dBTP (two-pass `loudnorm`).

With `file: null` nothing snaps and only the generated SFX play.
