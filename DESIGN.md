# design

feega is a motion studio. Everything it shows, the app and the videos it makes, follows one taste:
**a minimal look with real energy.** Few elements, a lot of space, confident type, real product,
movement that is precise and never decorative. This file is the source of truth for that taste;
the tokens and component rules it names live in `docs/design/app-ui.md` and `src/app.css`.

## 1. the app

### the rules that never bend

| Rule | Value |
|---|---|
| Shapes | **a sharp rectangle or a perfect circle, nothing in between.** Pages, panels, menus, nodes, cards, inputs: 0px (`--radius: 0`). Icon buttons, avatars, status dots and a button pill may be fully round (`rounded-full`). Never an intermediate radius (`rounded-md`, `8px`). |
| Dark background | **`#000`**, pure. Surfaces step up in small increments (`#0a0a0a`, `#111`, `#161616`). |
| Light background | `#ffffff`, one secondary surface `#fafaf8`. |
| Accent | one: `#0099ff` (`--ui-accent`). Selection, focus, primary action. Nothing else is blue. |
| Borders | **almost none.** Separate with space and a slightly different surface, not lines. A hairline only where a boundary is functional (inputs, the timeline grid). |
| Density | super minimal: small, clean type, generous space, one primary action per view. |

### type

| Role | Style |
|---|---|
| **Page and section titles** | **mega type, lowercase.** Very large display size (`clamp(40px, 4.5vw, 72px)` on desktop pages, `clamp(36px, 10vw, 64px)` on mobile), tight tracking (-0.04em), weight 600, line-height 0.95. Always lowercase, including the first letter: `gallery`, `your videos`, `create a video`. |
| UI text | DM Sans, scale 11/12/13/15/20 (`--ui-text-xs…xl`). |
| Labels, timecodes, ids | Fragment Mono (`--ui-mono`). |

Mega type is for the one title that names a view. Sign in is the exception: its title is small (20px), it is not a page the user cares about. Everything under it stays small; the contrast
between the two is the point.

### layout

- `/app` and its tools live in one shell: a **220px sidebar always open from 1024px**, a drawer
  behind a hamburger below. Its entries are one table, `src/lib/app-nav.ts`.
- Motion comes first: the home leads with **create a video** (a URL or a description), then the
  gallery and templates. The canvas supports motion as the place where assets are made.
- Cards: a large preview, a small title and author underneath, no frame. Previews play on hover
  (on touch, when in view).
- Filters are light: text or chips, icons that show what they mean (a format chip draws its real
  proportions), sliders for ranges. Every list has an empty state with a way out.
- Every UI works at 390px and on touch: targets of at least 44px, no hover-only features.

### states

Hover is a wash (`--ui-hover`), focus an accent ring, selection an accent wash with accent text.
Loading shows skeletons, never spinners in the middle of a page. Errors say what happened and
what to do.

## 2. the videos

These are rules for every video feega makes, by hand, by template or by the agent in the chat.
They are enforced by the quality gate (`src/lib/motion/direction.ts`, one `SEVERITY` table) and
the style system (`src/lib/motion/style.ts`); the default style is the launch film.

### the look

- Minimal and premium, in the spirit of an Apple, Linear or Vercel launch film.
- **Real energy:** kinetic type, cuts on the music, camera moves, devices flying in, one clear
  peak moment. Never a slideshow.
- **Never PowerPoint:** no bouncing or flying-in text, no spins, no decorative glows, particles or
  gradients on UI.
- **The UI is rebuilt, not screenshotted.** Product interfaces are recreated as live vector UI
  (the UI kit, `recreate_ui`), full of plausible content, never empty boxes. A screenshot is at
  most a blurred background.
- Micro-interactions on springs (closed-form, pure functions of time); UIs morph from one state to
  the next instead of leaving and entering; a cursor clicks exactly on real elements.

### words and pictures take turns

- **Little text.** Most of the video is scenes: the rebuilt UI, devices, the product. Fewer than
  one word per second of video.
- **A title owns the frame.** When words appear they are a title card: big, centred, nothing else
  competing. The scene it announces comes after.
- **Alternate:** title card → scene → title card → scene. Never a headline laid over a UI,
  device or picture; only short labels that belong to the rebuilt UI itself.

### the story

Every brand or product video has four acts: **problem → solution → product and proof → claim.**
The problem is concrete and specific to the brand, taken from its own site. Every claim in the
video must be quoted from the site. The video must follow its script: every act, its key lines,
the full promise and the logo.

### the pace

The rule that matters most, and the one most often broken: **it is always too fast.**

| Rule | Value |
|---|---|
| Scene length | 2–5 s |
| Changes | on the bar, not on every beat |
| Animations | always **finish**, then **hold 1–1.5 s** before any cut |
| Cuts | never in the middle of an animation |
| Text on screen | reading time + 1 s |
| Length | a longer video beats a compressed one; fewer ideas beats faster ones |
| Ending | the last frame is content, never a black tail |

Energy comes from the quality of the movement, never from cramming more events per second.

**Easing is strongly accentuated, with a soft settle.** Expo-like curves that land with an almost
imperceptible resistance: at most 1–2% past the mark, never a visible bounce.

| Move | Curve |
|---|---|
| Entrance | `feega.out` (keyframe ease `enter`) |
| Exit | `feega.in` (`exit`) |
| Move, zoom, morph | `feega.inOut` (`standard`, the default) |
| Drift, loop | linear, only there |
| Springs | near critical damping |
| Never | sine, power1, plain ease, back, elastic, bounce, overshoot |

The weak-ease gate names the rest.

### transitions

Every junction is smooth: match cuts, zoom-through, whip with motion blur, shared elements that
transform. A hard cut is a deliberate exception on the beat.

### brand rules

- **A real brand's logo is the original asset, flat and untouched.** No 3D, no recolouring, no
  filters, no distortion. A simple fade or scale of the whole logo only.
- Brand colours come from the brand's site; if it has no accent, use a neutral palette, never an
  invented colour.
- A fictional brand is declared as such and never resembles a real one.
- When a liked video is rebranded, only names, logo and URLs change; everything else stays.

### frame and background

- Nothing important leaves the safe area (5%) unless it is a deliberate exit.
- Backgrounds cover the whole frame: no clipped gradients, no visible edges, grain against
  banding.
- Pictures are never shown above 1.25× their real resolution.

### sound

Every launch video has music, cut on its beats. Generated in production (ElevenLabs), from the
internal CC0 library otherwise, always with its licence recorded.

## 3. where it lives

| What | Where |
|---|---|
| Tokens and component rules | `docs/design/app-ui.md`, `src/app.css` |
| Video style system | `src/lib/motion/style.ts` |
| Quality gate | `src/lib/motion/direction.ts` (`SEVERITY`) |
| Scene and UI kits | `src/lib/motion/template/scenes.ts`, `src/lib/motion/ui-kit/` |
