import type { MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { setExpression } from '../expression/ops';
import { PlayMode, interactiveOf, type Interactive } from './settings';

export enum InteractivePreset {
  CursorParallax = 'cursor-parallax',
  CardTilt = 'card-tilt',
  FollowCursor = 'follow-cursor',
  ScrollScrub = 'scroll-scrub'
}

export const INTERACTIVE_PRESETS = Object.values(InteractivePreset) as [InteractivePreset, ...InteractivePreset[]];

type Lanes = Record<string, string>;

type PresetSpec = { label: string; about: string; clip: boolean; lanes: Lanes; interactive: Partial<Interactive> };

export const PRESET: Record<InteractivePreset, PresetSpec> = {
  [InteractivePreset.CursorParallax]: {
    label: 'Cursor parallax',
    about: 'the layer drifts a little with the cursor (copy it to several layers with different depths for depth)',
    clip: true,
    lanes: {
      x: 'value + (input.smooth(input.pointer.x, 0.2) - 0.5) * 0.08',
      y: 'value + (input.smooth(input.pointer.y, 0.2) - 0.5) * 0.08'
    },
    interactive: {}
  },
  [InteractivePreset.CardTilt]: {
    label: '3D card tilt',
    about: 'the layer turns in 3D towards the cursor and the phone tilt, and lifts on hover',
    clip: true,
    lanes: {
      rotateY: 'value + (input.smooth(input.pointer.x, 0.15) - 0.5) * 30 + input.smooth(input.tilt.x, 0.15) * 20',
      rotateX: 'value - (input.smooth(input.pointer.y, 0.15) - 0.5) * 30 - input.smooth(input.tilt.y, 0.15) * 20',
      scale: 'value + input.smooth(input.hover, 0.2) * 0.04'
    },
    interactive: {}
  },
  [InteractivePreset.FollowCursor]: {
    label: 'Follow the cursor',
    about: 'the layer follows the cursor, easing behind it',
    clip: true,
    lanes: {
      x: 'value + input.smooth(input.pointer.x, 0.12) - 0.5',
      y: 'value + input.smooth(input.pointer.y, 0.12) - 0.5'
    },
    interactive: {}
  },
  [InteractivePreset.ScrollScrub]: {
    label: 'Scroll scrubs the timeline',
    about: 'scrolling the host page moves the playhead from start to end',
    clip: false,
    lanes: {},
    interactive: { playback: PlayMode.Scrub }
  }
};

export function setInteractive(doc: MotionDoc, patch: Partial<Interactive>): OpResult {
  return { ok: true, doc: { ...doc, interactive: { ...interactiveOf(doc), ...patch } } };
}

export function applyInteractivePreset(doc: MotionDoc, preset: InteractivePreset, clipId: string | null): OpResult {
  const spec = PRESET[preset];
  if (spec.clip && !clipId) {
    return { ok: false, error: `${spec.label} needs a clip` };
  }
  const start = Object.keys(spec.interactive).length ? setInteractive(doc, spec.interactive) : { ok: true as const, doc };
  return Object.entries(spec.lanes).reduce<OpResult>((r, [key, source]) => (r.ok ? setExpression(r.doc, clipId ?? '', key, source) : r), start);
}
