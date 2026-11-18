import { CameraMotion } from './core/camera-motion';

export enum FrameMode {
  Live = 'live',
  Snapshot = 'snapshot'
}

export const MAX_LIVE_FRAMES = 3;

type Candidate = { id: string; visible: boolean; area: number };

export function liveFrameModes(frames: readonly Candidate[], max: number, motion: CameraMotion): Record<string, FrameMode> {
  const modes = Object.fromEntries(frames.map((f) => [f.id, FrameMode.Snapshot]));

  if (motion === CameraMotion.Moving) {
    return modes;
  }

  const live = frames.filter((f) => f.visible).sort((a, b) => b.area - a.area).slice(0, max);

  for (const f of live) {
    modes[f.id] = FrameMode.Live;
  }

  return modes;
}
