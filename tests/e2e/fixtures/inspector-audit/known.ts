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

const HEX_COLLAPSED: Known = {
  mouse: [Check.Missing],
  keyboard: [Check.Missing],
  severity: Severity.Blocker,
  why: 'the hex field of an effect colour with opacity is 0 px wide: chip and 40 px opacity field fill the 94 px control, so the colour cannot be typed',
  ref: 'src/lib/components/motion/ColorField.svelte:246 (.hex flex 1, min-width 0), :261 (.alpha 40 px), inside MotionInspector.svelte:1218'
};

const pickerOutOfTabOrder = (severity: Severity): Known => ({
  mouse: [Check.Commit],
  keyboard: [Check.Reach],
  severity,
  why: 'keyboard: Tab from the colour chip never enters the colour popover, rendered on body after the effect popover that traps Tab. mouse: harness mismatch, Playwright never sees the picker hex field settle inside the effect popover though a person can use it (audit probe "picker sequence")',
  ref: 'src/lib/components/motion/ColorField.svelte:131 (onBody); src/lib/components/ui/shell/SidePopover.svelte:69'
});

const SIZE_PRESET_STUCK: Known = {
  keyboard: [Check.Commit],
  severity: Severity.Minor,
  why: 'after a preset is picked the select keeps showing it, so picking the same preset again (after an undo or a typed size) fires no change',
  ref: 'src/lib/components/motion/MotionInspector.svelte:874 (static value="")'
};

const LABEL_ROW_17PX: Known = {
  mouse: [Check.Size],
  severity: Severity.Minor,
  why: 'the whole label row is the target but it is 17 px tall, under the 20 px floor',
  ref: 'src/lib/components/motion/InstanceInspector.svelte:286 (.field)'
};

export const KNOWN: Record<string, Known> = {
  'fx-drop-shadow/effects/Drop shadow Colour/#ff0000 in the hex field': HEX_COLLAPSED,
  'fx-inner-shadow/effects/Inner shadow Colour/#ff0000 in the hex field': HEX_COLLAPSED,
  'fx-glow/effects/Glow Colour/#ff0000 in the hex field': HEX_COLLAPSED,
  'fx-drop-shadow/effects/Drop shadow Colour/#ff0000 in the picker': pickerOutOfTabOrder(Severity.Blocker),
  'fx-inner-shadow/effects/Inner shadow Colour/#ff0000 in the picker': pickerOutOfTabOrder(Severity.Blocker),
  'fx-glow/effects/Glow Colour/#ff0000 in the picker': pickerOutOfTabOrder(Severity.Blocker),
  'fx-chroma-key/effects/Chroma key Key colour/#ff0000 in the picker': pickerOutOfTabOrder(Severity.Major),
  'fx-stroke/effects/Stroke Colour/#ff0000 in the picker': pickerOutOfTabOrder(Severity.Major),
  'fx-tint/effects/Tint Map black to/#ff0000 in the picker': pickerOutOfTabOrder(Severity.Major),
  'fx-tint/effects/Tint Map white to/#ff0000 in the picker': pickerOutOfTabOrder(Severity.Major),

  '0752f883/stack/W/ArrowUp': {
    mouse: [Check.Commit],
    keyboard: [Check.Commit],
    severity: Severity.Major,
    why: 'ArrowUp in W of a text that sits in an imported stack changes nothing',
    ref: 'src/lib/components/motion/StackSizeChip.svelte:38 (type), cause not isolated'
  },
  '0752f883/stack/W/type 120 + Enter': {
    keyboard: [Check.Commit],
    unstable: { mouse: [Check.Commit] },
    severity: Severity.Major,
    why: 'a typed W on a text in an imported stack does not land when the field is reached by Tab, and only sometimes by click',
    ref: 'src/lib/components/motion/StackSizeChip.svelte:38 (type), cause not isolated'
  },
  'frame/frame/Frame width/type 1200 + Enter': {
    keyboard: [Check.Commit],
    unstable: { mouse: [Check.Commit] },
    severity: Severity.Major,
    why: 'the field shows 1200 × 1200 but the frame doc keeps 1080 for more than 6 s',
    ref: 'src/lib/components/motion/FramePresetSection.svelte:43 (resize), cause not isolated'
  },

  'text/text/Size presets/48': SIZE_PRESET_STUCK,
  '0752f883/text/Size presets/48': SIZE_PRESET_STUCK,
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
