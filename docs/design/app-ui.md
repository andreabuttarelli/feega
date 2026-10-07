# App UI system

Dashboard (`/app`), tool pages, canvas chrome and the motion editor share one set of tokens,
defined in `src/app.css` (`--ui-*`). Square corners everywhere (`--radius: 0`).

## Surfaces and colour

| Token | Light | Use |
|---|---|---|
| `--ui-bg` | `#ffffff` | page, top bars, panels |
| `--ui-surface` | `#fafaf8` | the one secondary surface: preview stage, alternating rows, chips |
| `--ui-hover` | `#f2f2ef` | hover wash |
| `--ui-line` / `--ui-line-strong` | `#ececea` / `#dcdcd8` | hairlines / input borders |
| `--ui-ink` / `-2` / `-3` | `#111` / `#5c5c58` / `#93938e` | text, secondary, labels |
| `--ui-accent` | `#0099ff` | primary action, selection, focus, active state |
| `--ui-accent-wash` | accent 10% | selected chip/segment background |
| `--ui-ok` / `--ui-warn` / `--ui-danger` | green / amber / red | status squares (saved, saving, error) |
| `--playhead` | `#ff3b30` in both themes | the timeline playhead, the only red in the editor |

Dark mode redefines the same names under `[data-theme='dark']`. `.ui-app` (on the `/app` and
`/p` shells) maps the legacy `--accent` to the blue, so shared components follow.

## Rules

- **Top bars**: white, 48px (`--ui-bar-h`), hairline bottom border. No black bars. The motion
  editor uses 44px (`--ui-bar-h-dense`): breadcrumb, centred transport, composition chip.
- **Buttons**: primary = solid accent; secondary = white with `--ui-line-strong` border.
  Selected chip/segment = accent wash + accent text/border, never solid ink.
- **Type**: DM Sans for UI; Fragment Mono (`--ui-mono`, self-hosted) for section labels,
  timecodes, ids. Scale `--ui-text-xs/sm/md/lg/xl` = 11/12/13/15/20.
- **Spacing**: `--ui-space-1..8` = 4/8/12/16/24/32.
- **Icons**: 16px (`--ui-icon`), 14px in dense toolbars, 12px in timeline chips.
- **Focus**: accent border or `--ui-focus` ring.

## Timeline

One table, `src/lib/motion/track-style.ts`: each component maps to a family (text, image,
video, audio, shape, 3D, code, null, camera, mask) with a hue and a preview kind. The timeline is
a layer list (`src/lib/motion/timeline-layers.ts`): a 28px group row per track, a 28px row per
clip, and a 24px row per animated property when the layer is twirled open. Bars are a tint of
the hue (14% light, 22% dark) with a 35% hue border and a 3px hue left edge; selection is the
accent outline with 5px trim handles, so no family uses `#0099ff`. The playhead is `--playhead`.

Previews: image clips tile the asset; video clips show a filmstrip captured once per asset
(`src/lib/motion/filmstrip.ts`, ≤24 frames, queued, cached, only when the clip scrolls into
view); audio clips draw the decoded waveform; text clips show the text.
