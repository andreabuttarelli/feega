# design

feega is a motion studio. Everything it shows, the app and the videos it makes, follows one taste:
**a minimal look with real energy.** Few elements, a lot of space, confident type, real product,
movement that is precise and never decorative. This file is the source of truth for that taste;
the tokens and component rules it names live in `docs/design/app-ui.md` and `src/app.css`.

## 1. the app

### the rules that never bend

| Rule | Value |
|---|---|
| Shapes | **a radius scale, one role per step** (`--ui-radius-*`): `none` 0 for frames and nodes' content, full-bleed panels and bars; `xs` 2px for kbd, checkboxes, swatches; `sm` 4px for buttons, inputs, rows, segments; `md` 6px for menus, popovers, segmented tracks, cards; `lg` 10px for dialogs, sheets and floating bars; `full` for avatars, dots, pills. Pick the step by role, never a free value. |
| Greyscale | **a 13-step pure-grey ramp** (`--grey-0…12`, light and dark) and **semantic roles on top** (`--ui-app`, `--ui-canvas`, `--ui-panel`, `--ui-panel-sunken`, `--ui-panel-raised`, `--ui-input`, `--ui-wash`, `--ui-pressed`, `--ui-divider`, `--ui-text*`, `--ui-icon-ink`). Components use roles, never a ramp step and never a hex. Every text role reads at WCAG AA on every surface role (`src/lib/greyscale-tokens.test.ts`). |
| Elevation | the canvas is the lowest plane in both themes; panels sit one clear step above it; menus, popovers and floating bars sit above panels with `--ui-shadow-float`. Light: canvas `#ebebeb`, panels white. Dark: canvas `#121212`, panels `#1f1f1f`, raised `#272727`. |
| Canvas | `--ui-canvas` with a `--ui-canvas-dot` grid. |
| Accent | one hue. `--ui-accent` `#0099ff` for selection outlines, focus rings and pressed tools; `--ui-accent-solid` `#0b6bcb` under white text (primary buttons, AA); `--ui-accent-text` for accent-coloured text (AA on panels). Nothing else is blue. |
| Borders | **almost none.** Separate with space and a slightly different surface, not lines. A hairline only where a boundary is functional (inputs, the timeline grid). |
| Density | super minimal: small, clean type, generous space, one primary action per view. |

### the shell system

The tokens live in `src/app.css`; Tailwind exposes the roles as `bg-ui-panel`, `text-ui-text-2`,
`rounded-sm`, `text-ui-label`, `shadow-ui-float`… (`src/lib/styles/tailwind.css`). The primitives
live in `src/lib/components/ui/shell/` and every bar and panel is built from them:

| Primitive | Use |
|---|---|
| `Panel` (`surface` panel / sunken / raised) | a side panel, a docked bar, a floating card |
| `PanelHeader` | the one title of a panel (13px semibold) plus its icon actions, 40px, divider below |
| `Section` (`fold` fixed / open / closed) | a group inside a panel, caps label (10.5px, 600, +0.06em, tertiary) |
| `Row` | a list row (Layers, assets): 28px, indent 12px per level, hover wash, selection = accent wash + accent text, trailing actions revealed on hover (always on touch) |
| `Field` + `FIELD_INPUT` | label (12px secondary) left, control right; inputs filled `--ui-input`, no border, 28px |
| `IconButton` (`size` sm 24 / md 28 / lg 32, `tone` ghost / filled / accent) | every icon action; always a tooltip with its name and shortcut |
| `SegmentedControl` | 2–5 exclusive options: a sunken track, the chosen one raised |
| `Toolbar` (`placement` inline / floating) + `ToolbarDivider` | a row of tools; floating = raised, `lg` radius, float shadow |
| `Hint` + `Kbd` | tooltip with the shortcut in platform glyphs (`⌘⇧Z` / `Ctrl+Shift+Z`) |
| `Menu`, `MenuContent`, `MenuItem`, `MenuLabel`, `MenuSeparator` | every dropdown and context menu: icon · label · shortcut, 28px rows, danger tone in red |

Sizes: 4px grid (`--ui-space-*`); rows 28 / 32 / 36 (`--ui-row-sm/row/row-lg`), 44 on touch;
icons 12 / 14 / 16 / 20 (`--ui-icon-xs/sm/—/lg`). Motion: 120 / 200 / 320 ms on `--ui-ease`
(expo out). Focus: `--ui-ring`, a 2px accent ring, on every focusable element via `focus-visible`.

| Type role | Size / weight | Token |
|---|---|---|
| Panel title | 13px / 600, -0.01em | `text-ui-title` |
| Section title | 13px / 600, sentence case | `SECTION_TITLE` |
| Menu group label | 10.5px / 600, caps, +0.06em, tertiary | `SECTION_LABEL` |
| Body, menu item | 13px / 400 | `text-ui-body` |
| Label, row | 12px / 400–500 | `text-ui-label` |
| Value, timecode, shortcut | 11px Fragment Mono, tabular | `text-ui-caption` + `--ui-mono` |
| Caption, hint | 11px / 400, tertiary | `text-ui-caption` |

### panels and inspector (reference: a pro design editor, dark first)

These rules apply to every panel, including the Properties inspector:

- **Elevation reads at a glance:** canvas darkest, side panels one step lighter, inputs one more
  step (`--ui-canvas` < `--ui-panel` < `--ui-input`). Never a border where a step will do.
- **Generous targets:** rows 32px (`--ui-row`), inputs 32px, panel header 48px; 44px on touch.
- **Panel tabs:** a `SegmentedControl` at the top of a panel switches its views (right panel:
  Chat / Properties). No underlined tabs.
- **Sections:** bold sentence-case title (13px semibold, `Section`), a `+` `IconButton` at the
  right when the section can add something (Layout, Effects, Fill…). No caps headers inside
  the inspector; caps stay for menu group labels.
- **Rows:** label left (secondary, 12–13px), control right (`Field`). Values in filled
  inputs with `md` radius (`FIELD_INPUT`), mono tabular numbers.
- **Controls:** inline dropdowns for modes (Fixed / Fit), segmented Yes / No for booleans, number
  + slider for opacity, a swatch + value row for Fill / Border / Shadows with an `Add…` empty state.
- **Action rows:** a row of icon actions (align, distribute) sits at the top of Properties, each
  an `IconButton` with a tooltip and shortcut.
- **Tree selection:** the selected row is a solid accent row with white text; the rows inside it
  are tinted with the accent wash. Each type has its icon.
- **Floating toolbar:** round tool buttons (`full` radius) in a pill bar, the zoom at the end.
- **Collaborators:** cursors carry a coloured name pill; avatars sit in the top bar, right.
- **Type colours:** layer icons use `--ui-type-frame` / `--ui-type-text` / `--ui-type-media`.
- **Top bar** (canvas and inline frame editor, 48px, one row):

  | Zone | Browsing | Frame open |
  |---|---|---|
  | Left | menu · project / canvas | menu · project / canvas · frame name + save dot · Design / Motion |
  | Centre | canvas title | playback: start · step · play · step · end · timeline · timecode |
  | Right | avatars · credits · **Share** · chat | undo · redo · history · more · Export · Full screen · close ‖ avatars · credits · **Share** · chat |

  Every control is **28px tall** (`--ui-control-h`; 44px on touch). One style per role: icon
  actions are ghost squares (`sm` radius, wash on hover, accent wash when pressed); text actions
  are ghost (`Full screen`, `Storyboard`) or filled secondary (`Export`); **Share is the only
  primary** (solid accent). Inside a zone 4px apart; zones 16px apart. One status dot only: the
  frame's save dot replaces the canvas connection dot while a frame is open. An e2e check
  (`tests/e2e/top-bar-rhythm.spec.ts`) holds the heights and the shared centre line.

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
- The home holds three things and nothing else: a **hero** (mega slogan + one small subline over a
  dark, low-opacity backdrop cut from our own library, poster first, clip on idle, still under
  reduced motion), **recents** as a compact list (thumb · name · project · time), and **one prompt
  dock** anchored at the bottom with three suggestions. Top right: `new canvas` (the one accent
  button) and `import`. Catalogues live on their own page (templates), never as rows on the home.
- The account entries (settings, billing, changelog, theme, sign out…) sit in a menu behind the
  avatar at the foot of the sidebar, not in the sidebar itself.
- The sidebar nav is four plain entries (home, canvases, templates, tools) and the projects. Tools
  and the gallery live on the tools page; no badges in the nav.
- A list that sits above a docked composer scrolls in its own area: nothing passes behind the dock.
- Cards: a large preview, a small title and author underneath, no frame. Previews play on hover
  (on touch, when in view).
- Filters are light: text or chips, icons that show what they mean (a format chip draws its real
  proportions), sliders for ranges. Every list has an empty state with a way out.
- Every UI works at 390px and on touch: targets of at least 44px, no hover-only features.

### properties panel

The right panel reads like Figma's: a head with the selection's icon, name and kind, then
sections in one fixed order — Layout, Layer, Fill, Stroke, Effects, Text, Animation (Motion mode
only). Which sections a selection gets is one table (`src/lib/motion/properties-view.ts`); which
section a field lands in is another (`src/lib/motion/inspector-sections.ts`).

- Rows are 28px, labels in English on the left (88px), never a glyph alone; numbers carry their
  unit and scrub when the label is dragged. Short numbers pair up in two columns.
- A colour is one field: swatch, hex, and a popover with the picker, brand and recent colours.
- Two to three exclusive options are a segmented toggle (align, fit), not a dropdown.
- Several layers show their shared value, or an empty field reading `Mixed`.
- The panel runs the editor's full height and scrolls on its own.

### states

Hover is a wash (`--ui-wash`), pressed a deeper grey (`--ui-pressed`), focus an accent ring, selection an accent wash with accent text.
Hovering a Layers row outlines what it names on the canvas in `--ui-hover-outline` (violet
`#b14cff`), never the accent: hover and selection must read apart at a glance.
Panels that open or fold (the timeline in Design mode) move on `--ease-expo-out`, 320 ms.

### selecting inside a frame

Figma's drill-in. A depth is what is selected: the canvas (frame closed), the frame (open,
nothing inside), a clip, a part (a poster line, a photo, a text). One table decides every gesture
(`DRILL` in `src/lib/motion/drill.ts`); a new case is a row there, never an `if` elsewhere.

| gesture | canvas | frame | clip | part |
|---|---|---|---|---|
| hover | outline the child under the pointer | same | the part under the pointer, else the clip | same |
| click | the frame | the clip under the pointer | a sibling clip (same spot again: the one beneath) | a sibling part, else the clip |
| double-click | the child under the pointer | same | its part under the pointer, else edit its text | edit the text |
| ⌘/Ctrl-click | the innermost element | same | same | same |
| Enter | — | the top clip | its first part | edit the text |
| Esc, ⇧Enter | — | close the frame | the frame | the clip |

Empty space inside the frame selects the frame. Hover never reopens or re-renders a node: a
closed frame measures its children once, on the first pointer enter. Layers follows: the
selected row scrolls into view, hover lights the row and the row lights the canvas.
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
- **Title type:** semibold (600) or medium (500), never bold, black or light; very tight
  tracking, -0.04 to -0.06em (default -0.05em), like the app's mega titles. Body copy and UI
  labels keep their own.
- **Alternate:** title card → scene → title card → scene. Never a headline laid over a UI,
  device or picture; only short labels that belong to the rebuilt UI itself.

### one part of the UI at a time

- **As with words, so with UIs.** A product act is a sequence of UI beats: one element (or two
  that belong together) per beat, large in the frame, faithful to the real product, then the next.
- **Example:** someone types a prompt → zoom on the text field and the typed text → the button
  being pressed → the progress bar alone → the result.
- **Isolate and zoom** (`focus_ui` on an anchor of `add_ui` / `recreate_ui`): the part alone, the
  rest masked away. Between beats a zoom or a shared-element morph, never a cut to a new full screen.
- **The whole screen only briefly:** an establishing shot or the end. Never a busy dashboard held
  on screen (gate `ui-overload`: a whole UI held over 1.5 s, more than two UI pieces at once).

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
