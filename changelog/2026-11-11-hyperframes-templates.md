# hyperframes templates

64 blocks and components of the HyperFrames registry (Apache-2.0) are built-in motion templates `builtin:hyperframes-<id>`: 12 lower thirds, 8 captions, 11 text effects, 3 titles, 10 charts and counters, 7 UI cards, 10 wipes and transitions, 3 ambient overlays.

- **Why a new engine file.** The sources are DOM + GSAP timelines. `hyperframes/kit.ts` is a deterministic GSAP-like timeline (`to/from/fromTo/set`, stagger, repeat/yoyo, position strings, labels, colour and complex-string interpolation) plus the GSAP eases as exact functions (power1-4, sine, expo, circ, back, elastic, bounce, steps), tested against known values. A port copies the upstream tweens and renders any time without state, so seeking in any order gives the same frame.
- **Ports.** Same shape as snapcn: `ports/<id>.ts` exports `PORT`; the draw is serialised, so it only references its arguments. Text, colours and numbers are fields with the upstream defaults; the catalog test rejects brand names, remote URLs and a prop called `name` (the clip owns it).
- **Left out.** Anything WebGL/canvas/shader/3D, anything built on footage or audio, every brand-named block, items by other authors or under another licence, `hw-write-title` (150 KB baked glyph table), and near-duplicates of existing feega templates.
- **Licence.** Apache-2.0 text, copyright and the statement of changes are in `THIRD_PARTY_NOTICES.md`.
