import { Check, Severity, type Known } from './checks';

const AUDIT = 'PR #2088 round 2';

const STALE_CANVAS: Known = {
  unstable: { mouse: [Check.Canvas], keyboard: [Check.Canvas] },
  severity: Severity.Major,
  why: 'the value lands but the canvas keeps or brings back a stale picture: after an undo the picture flips back to the edited state about 3 s later, so the next change shows no pixel difference',
  ref: `${AUDIT}; canvas renderer, not located`
};

const LINE_CANVAS: Known = {
  unstable: { keyboard: [Check.Canvas] },
  severity: Severity.Major,
  why: 'a keyboard-driven change to the line stroke often shows no canvas change within 2 s while the same change by mouse repaints; not isolated from the stale picture above',
  ref: `${AUDIT}; canvas renderer, not located`
};

const LABEL_ROW_17PX: Known = {
  mouse: [Check.Size],
  severity: Severity.Minor,
  why: 'the whole label row is the target but it is 17 px tall, under the 20 px floor',
  ref: 'src/lib/components/motion/InstanceInspector.svelte:286 (.field)'
};

export const KNOWN: Record<string, Known> = {

  'text/text/Paragraph spacing/type 1 + Enter': {
    mouse: [Check.Size],
    severity: Severity.Minor,
    why: 'the paragraph spacing input is squeezed to 20 px between its label and unit',
    ref: 'src/lib/components/motion/MotionInspector.svelte:853 (pair cell)'
  },

  'card-instance/instance/Boolean property/toggle off': LABEL_ROW_17PX,
  'card-instance/instance/Visibility override/hide an element': LABEL_ROW_17PX,
  'card-instance/instance/Reset fill override/press': {
    mouse: [Check.Size],
    severity: Severity.Minor,
    why: 'the Reset text button is 17 px tall',
    ref: 'src/lib/components/motion/InstanceInspector.svelte:277 (.reset)'
  },
  'gradient/stroke/Stroke per side/toggle': {
    mouse: [Check.Size],
    severity: Severity.Minor,
    why: 'the per-side label row is 18 px tall',
    ref: 'src/lib/components/motion/StrokeStack.svelte:211'
  },
  'gradient/fill/Gradient bar/add a stop': {
    mouse: [Check.Size],
    keyboard: [Check.Reach, Check.Commit],
    severity: Severity.Minor,
    why: 'the bar is a 16 px pointer-only target; the keyboard adds stops with the + button, covered by its own row',
    ref: 'src/lib/components/motion/FillStack.svelte:333'
  },
  'image-fill/fill/Image contrast slider/drag': {
    mouse: [Check.Size],
    severity: Severity.Minor,
    why: 'image adjustment sliders are 4 px tall; the number field beside each is the reliable target',
    ref: 'src/lib/components/ui/control/slider-field.svelte:12'
  },

  'bound/variables/Theme mode/Dark': STALE_CANVAS,
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
