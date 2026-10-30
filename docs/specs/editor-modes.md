# Editor modes

Status: accepted 2026-10-29. ADR: [0023](../adr/0023-four-global-editor-modes.md).

## Problem

Features are spread over the burger, canvas-name dropdown, add bar (Design/Generate), selection
"…" menu, context menu, frame overlay, frame mode row and keyboard-only toggles. Several exist in
one hidden place only. Shortcuts collide. "Frame", "Play" and "Present" mean several things.

## Model

Four global modes, icon segments at the left of the bottom bar: **Design · Motion · Play ·
Code**. Mobile: bottom pill. One verb per mode.

| Mode | Verb | Edits | Canvas shows |
|---|---|---|---|
| Design | build | change base values | node lines; timeline via ⌘J, read-only/scrub |
| Motion | record time | every property edit creates/moves a keyframe at playhead; drawing creates base | coloured recording border on canvas + right bar; motion paths, onion skin, playhead; ◇ keyframe toggle per inspector property |
| Play | connect & try | prototype links only | arrows element → frame; node lines hidden |
| Code | read & export | none | code inspector inline in right bar |

- `E` toggles Design ↔ Motion (existing).
- Editing an animated property in Design shifts the whole animation of that property, curve
  shape preserved, with a small notice.
- Play: drag from an element (e.g. a button) to a frame to link; on the link choose trigger,
  transition, duration (Figma-style). Hosts Interactive, Flow, per-frame Play switch, copy play
  link. Runs from the selected frame: in-canvas on desktop, fullscreen on mobile.
- Code: absorbs Coder mode (⇧D, dev inspector) and "Export code…" (React/HTML/Svelte, copy,
  full export) inline in the right bar. Starting point: draft PR #1512.
- "Present" stays the collaborator spotlight; never used for prototype playback.
- The "…" selection menu and frame overlay buttons remain as shortcuts. **No feature may live
  only there.**

## Insert

The add bar loses Design/Generate. One "+" insert menu: drawing tools, AI generate nodes,
upload/import (file, Drive/Dropbox, Figma), templates.

## Left panel

Figma-style. **Pages** = canvases of the project (new, rename, delete, versions, comments,
import/export .feega); replaces the canvas-name dropdown. **Layers** = current page. Top-left
keeps only project switcher + burger.

## Fixes

- Shortcut conflicts, resolved in one table per mode:
  - ⇧A: "Stack" and "Add auto layout" become one action.
  - ⌘]/⌘[ = bring forward/send backward everywhere; ⌥⌘]/⌥⌘[ = front/back.
  - Digits = opacity on a selection; add-node digits move into the insert menu.
  - Bare tool letters (T R O L P X K) vs Motion transport (J K L I O B N…): transport only in
    Motion, tools only in Design.
- One shortcut list: burger submenu and `?` overlay render the same source, including
  frame-level shortcuts; mobile gets it as a sheet.
- Naming: "Frame" = the design/motion frame only; canvas tiles are "nodes"; "Frame selection"
  becomes "Wrap in frame". Help text "Design or Animate" → "Design or Motion".
- View menu (header): outlines, pixel grid, guides, rulers, pivot. Keys unchanged.
- Layer ops (align, booleans, mask, auto layout, create component, hide, lock) in the right bar
  in Design mode and via touch long-press. Menu actions missing from the menu order
  (create/detach/push/reset instance) get a home.
- Generated image/video nodes get right-bar properties.
- Studio reachable on desktop (rail). Connect available on mobile.

## Feature → today → new home

| Feature | Today | New home |
|---|---|---|
| Switch / new / rename / delete canvas | canvas-name dropdown; mobile switcher | Pages panel |
| Canvas versions | dropdown "Versions…" | Pages row menu |
| Comments | dropdown, add bar, `C` | Pages row menu + header; `C` stays |
| Import / download .feega | dropdown (desktop only) | Pages panel menu |
| Project switcher | top bar | top-left (unchanged) |
| Share, peers, credits, chat toggle | top bar | top bar right (unchanged) |
| Connect (agent) | top bar, desktop only | top bar; mobile burger |
| Studio | burger only | rail + burger |
| Layers panel | rail / mobile segment | left panel Layers |
| Assets / Brands / Influencers | rail, ⌥1–4 | unchanged |
| Shortcuts reference | burger submenu (desktop), `?` | one list, both entries, mobile sheet |
| Add bar Design/Generate radio | add bar | removed; "+" insert menu |
| Draw tools, More tools | add bar Design | "+" menu, tools |
| AI nodes, More nodes, digit keys | add bar Generate | "+" menu, generate |
| Upload, Drive/Dropbox, Figma import | add bar | "+" menu, import |
| Templates, frame templates, trailer, insert image, frame library | add bar | "+" menu |
| Zoom readout | add bar | add bar (unchanged) |
| Run flow / technique / from here / re-run / stop | selection toolbar | unchanged |
| Connect to / connect to new | selection toolbar | unchanged |
| Remove bg, upscale, inpaint, outpaint, reframe, split into layers, layers to frame | selection toolbar | toolbar + right bar of the generated node |
| View output, compare, variants | selection toolbar | unchanged + right bar |
| Group / ungroup / duplicate / copy / paste | toolbar, context menu, keys | unchanged + right bar |
| Align, tidy up, stack / auto layout | context menu, keys | right bar Design + long-press |
| Booleans, flatten, outline stroke/text, mask, flips | context menu, keys | right bar Design + long-press |
| Create component, detach / push / reset instance | partly unreachable | right bar Design + context menu |
| Hide / lock | keys only | Layers row + context menu |
| Copy/paste props, paste over/replace, select matching | keys, partly menu | context menu |
| Bring front/back, forward/backward | context menu, conflicting keys | context menu, unified keys |
| Section, frame selection, resize to fit, precompose | context menu, keys | right bar Design + context menu |
| Create formats, combine video | context menu | unchanged + right bar |
| Export… (still/scenes) | "…" menu | right bar export section + "…" |
| Export code… | "…" menu dialog | Code mode right bar (from #1512) |
| Coder mode ⇧D | frame mode row, ⇧D | Code mode (⇧D switches to it) |
| Design/Motion switch | frame mode row, `E` | bottom-bar mode control, `E` |
| Interactive… | "…" menu dialog | Play mode right bar |
| Live toggle on frame | frame overlay | Play mode right bar + overlay |
| Prototype flow + Play | inspector Flow section | Play mode right bar; runs from selection |
| Play link | inspector | Play mode right bar "Copy play link" |
| Present (spotlight) | collaborator feature | unchanged, name reserved |
| Voice-over, music | "…" menu | Motion mode right bar + "…" |
| Components…, templates… | "…" menu | Design right bar + "…" |
| Frame version history, branches | "…" menu | Design right bar section + "…" |
| Chat history, save as template, publish, copy id, report | "…" menu | "…" + right bar footer menu |
| Colour tag, export to cloud | "…" submenus | "…" + right bar |
| Timeline ⌘J | Motion | Design (read-only scrub) and Motion |
| Transport (Space, J/K/L, I/O, M, ⌥↵) | motion keys | Motion mode |
| Outlines ⌘Y, pixel grid ⇧', guides ⇧G, rulers ⌥⇧R, pivot ⌥R | keys only | View menu + keys |
| Opacity 0–9 | motion keys | Design, with a selection |
| Generated image/video properties | none | right bar |
| Mobile insert sheet | bottom switch "Insert" | "+" menu sheet |
| Mobile canvas switcher | title trigger sheet | Pages sheet |
| Mobile properties / layers / chat | bottom switch | bottom switch + mode pill |

## Out of scope

Data model changes; new export targets; Present redesign.
