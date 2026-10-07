import { FRAME_RATES, maxFrames, type FrameRate } from './design';
import { byFrame, type MotionClip, type MotionDoc } from './doc';
import type { Keyframes } from './keyframes';
import type { OpResult } from './timeline';

export { FRAME_RATES, maxFrames, type FrameRate };

type Scale = (frame: number) => number;

function rescaled(keyframes: Keyframes, scale: Scale): Keyframes {
  return Object.fromEntries(Object.entries(keyframes).map(([key, track]) => [key, byFrame(track.map((k) => ({ ...k, frame: scale(k.frame) })))]));
}

function retimed(clip: MotionClip, scale: Scale): MotionClip {
  return {
    ...clip,
    from: scale(clip.from),
    durationInFrames: Math.max(1, scale(clip.durationInFrames)),
    trimStart: scale(clip.trimStart),
    transitionIn: { ...clip.transitionIn, durationInFrames: scale(clip.transitionIn.durationInFrames) },
    transitionOut: { ...clip.transitionOut, durationInFrames: scale(clip.transitionOut.durationInFrames) },
    keyframes: rescaled(clip.keyframes, scale)
  };
}

export function setFrameRate(doc: MotionDoc, fps: FrameRate): OpResult {
  if (!FRAME_RATES.includes(fps)) {
    return { ok: false, error: `frame rate must be one of ${FRAME_RATES.join(', ')}` };
  }
  const scale: Scale = (frame) => Math.round((frame * fps) / doc.fps);
  const camera = doc.camera ? { ...doc.camera, keyframes: rescaled(doc.camera.keyframes as Keyframes, scale) } : null;

  return {
    ok: true,
    doc: {
      ...doc,
      fps,
      durationInFrames: Math.min(maxFrames(fps), Math.max(1, scale(doc.durationInFrames))),
      tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => retimed(c, scale)) })),
      camera
    }
  };
}
