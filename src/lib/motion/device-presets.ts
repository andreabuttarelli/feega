import { Ease, FPS } from './design';
import { findClip, type MotionDoc } from './doc';
import { Device, DEVICE, DeviceKind } from './devices';
import type { Keyframe } from './keyframes';
import { addClip, setKeyframes, type OpResult } from './timeline';

export enum DevicePreset {
  SpinIn = 'spin-in',
  HeroTurn = 'hero-turn',
  LidOpen = 'lid-open',
  FoldOpen = 'fold-open',
  ScreenScroll = 'screen-scroll'
}

export const DEVICE_PRESETS = Object.values(DevicePreset) as [DevicePreset, ...DevicePreset[]];

type Lanes = Record<string, Keyframe[]>;

const SETTLE_Y = -28;
const SETTLE_X = 6;
const SPIN_FRAMES = Math.round(1.6 * FPS);
const LID_FRAMES = Math.round(1.5 * FPS);
const LID_OPEN = 110;
const FOLD_FLAT = 180;
const SCROLL_LEAD = Math.round(0.8 * FPS);
const SCROLL_TAIL = Math.round(0.5 * FPS);

const key = (frame: number, value: number, ease: Ease = Ease.Standard): Keyframe => ({ frame, value, ease });

export const PRESET: Record<DevicePreset, { about: string; lanes: (length: number) => Lanes; fits: (kind: DeviceKind) => boolean }> = {
  [DevicePreset.SpinIn]: {
    about: 'spins in from behind and settles at a three-quarter view',
    fits: () => true,
    lanes: () => ({
      objectRotateY: [key(0, SETTLE_Y - 330, Ease.Enter), key(SPIN_FRAMES, SETTLE_Y)],
      objectRotateX: [key(0, 18), key(SPIN_FRAMES, SETTLE_X)],
      dolly: [key(0, 0.7), key(SPIN_FRAMES, 1)]
    })
  },
  [DevicePreset.HeroTurn]: {
    about: 'a slow turn from one three-quarter view to the other across the clip',
    fits: () => true,
    lanes: (length) => ({
      objectRotateY: [key(0, -35, Ease.Linear), key(length, 35)],
      objectRotateX: [key(0, SETTLE_X, Ease.Linear), key(length, SETTLE_X)]
    })
  },
  [DevicePreset.LidOpen]: {
    about: 'a laptop opens from closed to working angle',
    fits: (kind) => kind === DeviceKind.Laptop,
    lanes: () => ({
      lid: [key(0, 0), key(LID_FRAMES, LID_OPEN)],
      objectRotateX: [key(0, 24), key(LID_FRAMES, 12)]
    })
  },
  [DevicePreset.FoldOpen]: {
    about: 'a foldable phone unfolds from closed to flat',
    fits: (kind) => kind === DeviceKind.Foldable,
    lanes: () => ({
      fold: [key(0, 0), key(LID_FRAMES, FOLD_FLAT)],
      objectRotateX: [key(0, 18), key(LID_FRAMES, SETTLE_X)]
    })
  },
  [DevicePreset.ScreenScroll]: {
    about: 'scrolls a tall screenshot or page from top to bottom',
    fits: () => true,
    lanes: (length) => ({ screenScroll: [key(SCROLL_LEAD, 0), key(Math.max(SCROLL_LEAD + 1, length - SCROLL_TAIL), 1)] })
  }
};

export function applyDevicePreset(doc: MotionDoc, clipId: string, preset: DevicePreset): OpResult {
  const found = findClip(doc, clipId);
  if (!found || found.clip.component !== 'Device3D') {
    return { ok: false, error: `${clipId} is not a device mockup` };
  }
  const device = (found.clip.props as { device: Device }).device;
  const spec = PRESET[preset];
  if (!spec.fits(DEVICE[device].kind)) {
    return { ok: false, error: `${preset} does not fit a ${DEVICE[device].kind}` };
  }
  let next: OpResult = { ok: true, doc };
  for (const [prop, track] of Object.entries(spec.lanes(found.clip.durationInFrames))) {
    if (!next.ok) {
      return next;
    }
    next = setKeyframes(next.doc, clipId, prop, track);
  }
  return next;
}

const ROW_SLOTS = [0.2, 0.5, 0.8];
const ROW_WIDTH = 0.34;
const ROW_STAGGER = Math.round(0.25 * FPS);
const ROW_TURN = 14;

export type DeviceRow = { device: Device; screens: (string | null)[]; from: number; durationInFrames: number; ids: string[]; trackId?: string };

export function addDeviceRow(doc: MotionDoc, row: DeviceRow): OpResult {
  let next: OpResult = { ok: true, doc };
  for (const [i, x] of ROW_SLOTS.entries()) {
    if (!next.ok) {
      return next;
    }
    const id = row.ids[i];
    const props = { device: row.device, screen: row.screens[i] ?? row.screens[0] ?? null, x, width: ROW_WIDTH };
    next = addClip(next.doc, { component: 'Device3D', from: row.from + i * ROW_STAGGER, durationInFrames: row.durationInFrames - i * ROW_STAGGER, trackId: row.trackId, props }, id);
    if (next.ok) {
      const turn = (i - 1) * ROW_TURN;
      next = setKeyframes(next.doc, id, 'objectRotateY', [key(0, turn - 40), key(row.durationInFrames, turn + 10 * (i + 1))]);
    }
    if (next.ok) {
      next = setKeyframes(next.doc, id, 'dolly', [key(0, 0.85 + i * 0.05), key(row.durationInFrames, 1 + i * 0.08)]);
    }
  }
  return next;
}
