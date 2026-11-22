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

Feega version, `Launch` composition, 30 fps, 1224 frames (40.8 s). Motion spec per shot (scene-local frames):

| # | Start | Frames | Bg | Headline (boxed) | Motion | Exit |
|---|---|---|---|---|---|---|
| 1 | 0 | 90 | off-white | the best **free** / Lovable alternative. | words rise+tilt, 2 f stagger; box wipes from left at f≈24 (7 f) and word grows 6 %; creatures pop in from f14, 2 f stagger, then hop; specks drift by size (parallax) | pixel dissolve → black |
| 2 | 90 | 114 | black | click any / element of your / running **app**. | card slides in from right with 8° tilt (f4–24); cursor f26–58; hover f52, click f70; camera push-in 1.16× on the heading f50–72, pull back f96–112 | stepped panel → off-white |
| 3 | 204 | 120 | off-white | edit it / like in **Figma**. | card slides in (f0–16); push-in 1.12× on font-size field f14–32 while scrubbing 56→80 (f26–58); pull back f62–78; push-in on swatches f80–94; swatch opens f70, colour f92 | pixel dissolve → orange |
| 4 | 324 | 120 | orange | every edit / lands in / your **code**. | diff card slides in with −6° tilt (f6–26); lines stagger 5 f from f30; creatures pop onto the card top from f50; push-in 1.14× on the + line f66–84; green glint sweeps the line f74–90 | hard cut |
| 5 | 444 | 120 | black | 61 free **templates**. | carousel slides left f0–92, every tile bobs and rocks, creatures under tiles hop and lag (parallax 0.18); Library card rises with 10° tilt f64–80; cursor clicks "pricing" f98 | stepped panel → off-white |
| 6 | 564 | 105 | off-white | plugins, if you / want **more**. | mesh card enters tilted and floats; 3 points orbit, pointer drags the 4th f24–58; cube spins and hops; specks drift | pixel dissolve → black |
| 7 | 669 | 120 | black | works where you / **already** code. | 5 tiles flip in (rotateY 85°→0, rise 160 px, 3 f stagger, from f14); each tile floats; cursor sweeps tile to tile from f40 every 10 f, each lights (lift 14 px, orange border, "connected" badge pops, icon pulses) with a tick; 2 creatures run across; tiles regroup toward centre and shrink in the last 12 f | hard cut |
| 8 | 789 | 105 | off-white | every **framework**. | 8 tiles (React, Next.js, Vue.js, Nuxt, Svelte, Astro, React Router, Vite; 1646 px wide row, all visible) flip in 2 f stagger from f10; sweep from f34 every 6 f, "works" badge + tick each; 3 creatures run right→left; regroup | stepped panel → black |
| 9 | 894 | 90 | black | works with / your **agent**. | 4 tiles (Claude Code, Codex wordmark, Cursor, Gemini CLI) flip in from f12; sweep from f34 every 9 f; creature row pops in under them and hops; regroup | pixel dissolve → orange |
| 10 | 984 | 105 | orange | free and / **open source**. | chip rises f24–40; cursor clicks star f66; 9 pixel stars burst outward and spin; creature row jumps on the click | stepped panel → black |
| 11 | 1089 | 135 | black | Feega mark + "design in your codebase." | logo scales in f4; creatures run in from both sides (3 f stagger, tilted) then hop; tagline + chip; two creatures run across from f70; hold to the end | — |

Every section also pushes in 3.5 % over its length and, in its last 12 f, slides 140 px left and
shrinks 6 % under the wipe. SFX: pop on each word box, tap per lit list item, whoosh at each wipe
start, click on cursor clicks, click on hard cuts, chime on the logo.
