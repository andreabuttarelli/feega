import { resizeFrame } from './constraints/constraints';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { CanvasSize, OpResult } from '@feega/motion-core/motion/timeline';

export enum FramePreset {
  Phone = 'phone',
  Tablet = 'tablet',
  Desktop = 'desktop',
  Presentation = 'presentation',
  Watch = 'watch',
  Paper = 'paper',
  Social = 'social'
}

export const FRAME_PRESETS = Object.values(FramePreset) as [FramePreset, ...FramePreset[]];

export const PRESET_SIZE: Record<FramePreset, CanvasSize> = {
  [FramePreset.Phone]: { width: 393, height: 852 },
  [FramePreset.Tablet]: { width: 834, height: 1194 },
  [FramePreset.Desktop]: { width: 1440, height: 1024 },
  [FramePreset.Presentation]: { width: 1920, height: 1080 },
  [FramePreset.Watch]: { width: 198, height: 242 },
  [FramePreset.Paper]: { width: 595, height: 842 },
  [FramePreset.Social]: { width: 1080, height: 1350 }
};

export const PRESET_LABEL: Record<FramePreset, string> = {
  [FramePreset.Phone]: 'Phone',
  [FramePreset.Tablet]: 'Tablet',
  [FramePreset.Desktop]: 'Desktop',
  [FramePreset.Presentation]: 'Presentation',
  [FramePreset.Watch]: 'Watch',
  [FramePreset.Paper]: 'Paper (A4)',
  [FramePreset.Social]: 'Social'
};

export const applyPreset = (doc: MotionDoc, preset: FramePreset): OpResult => resizeFrame({ ...doc, freeSize: true }, PRESET_SIZE[preset]);

export const resizeTo = (doc: MotionDoc, size: CanvasSize): OpResult => resizeFrame({ ...doc, freeSize: true }, size);

export const presetOf = (doc: Pick<MotionDoc, 'width' | 'height'>): FramePreset | null => FRAME_PRESETS.find((p) => PRESET_SIZE[p].width === doc.width && PRESET_SIZE[p].height === doc.height) ?? null;
