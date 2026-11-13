import { Check, Severity, type Known } from './checks';

const AUDIT = 'PR #2088 round 2';

const STALE_CANVAS: Known = {
  unstable: { mouse: [Check.Canvas], keyboard: [Check.Canvas] },
  severity: Severity.Minor,
  why: 'the edit lands but draws nothing new: DM Sans is loaded at 400, 500 and 600 only, so 300 draws as 400; line height on one line, align right on an already right-aligned box and the gap of a one-child stack move no pixel. The first edit on a frame still shows a change because it swaps the saved picture for the live one (the imported frame background is white saved, light grey live); undo keeps the live picture, so the next attempt sees none',
  ref: `${AUDIT}; round 3 probe: packages/motion-core/src/motion/gpu-full/text/load.ts:11 and hyperframes/compose.ts:91 (wght@400;500;600)`
};

const LINE_CANVAS: Known = {
  unstable: { keyboard: [Check.Canvas] },
  severity: Severity.Major,
  why: 'the amber 6.5 px line draws no pixel on the canvas, before or after an edit: the display list marks a line shape unsupported and hands it to the picture fallback, which shows nothing here; only an arrow end cap appears. A width, hide or remove therefore changes nothing the probe can see',
  ref: `${AUDIT}; round 3 probe, packages/motion-core/src/motion/gpu-full/display-list.ts:174 (UNDRAWN_SHAPES), :198`
};

export const KNOWN: Record<string, Known> = {
  'gradient/fill/Gradient bar/add a stop': {
    mouse: [Check.Size],
    keyboard: [Check.Reach, Check.Commit],
    severity: Severity.Minor,
    why: 'the bar is a 16 px pointer-only target; the keyboard adds stops with the + button, covered by its own row',
    ref: 'src/lib/components/motion/FillStack.svelte:333'
  },

  'text/text/Weight/type 300 + Enter': STALE_CANVAS,
  '0752f883/text/Weight/type 300 + Enter': STALE_CANVAS,
  '0752f883/text/Line height/type 150 + Enter': STALE_CANVAS,
  '0752f883/text/Text align/Align right': STALE_CANVAS,
  '1c47f19d/stack/Gap/type 12 + Enter': STALE_CANVAS,
  'line/stroke/Stroke width/type 8 + Enter': LINE_CANVAS,
  'line/stroke/Stroke eye/hide': LINE_CANVAS,
  'line/stroke/Stroke remove/−': LINE_CANVAS,
  'line/stroke/Stroke end cap/arrow': LINE_CANVAS
};
