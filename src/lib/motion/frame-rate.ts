import { FASTEST_RATE, FRAME_RATES, maxFrames, type FrameRate } from './design';
import { byFrame, type Marker, type MotionClip, type MotionComp, type MotionDoc, type MotionTrack } from './doc';
import type { Keyframes } from './keyframes';
import { MAX_JUNCTION_FRAMES } from './junction-model';
import type { OpResult } from './timeline';

export { FRAME_RATES, maxFrames, type FrameRate };

type Scale = (frame: number) => number;

const MAX_EDGE_FRAMES = FASTEST_RATE * 2;
const MIN_JUNCTION_FRAMES = 2;

function rescaled(keyframes: Keyframes, scale: Scale): Keyframes {
  return Object.fromEntries(Object.entries(keyframes).map(([key, track]) => [key, byFrame(track.map((k) => ({ ...k, frame: scale(k.frame) })))]));
}

const markersAt = (markers: Marker[] | undefined, scale: Scale) => markers && byFrame(markers.map((m) => ({ ...m, frame: scale(m.frame) })));

function retimed(clip: MotionClip, scale: Scale): MotionClip {
  const edge = (frames: number) => Math.min(MAX_EDGE_FRAMES, scale(frames));
  return {
    ...clip,
    from: scale(clip.from),
    durationInFrames: Math.max(1, scale(clip.durationInFrames)),
    trimStart: scale(clip.trimStart),
    transitionIn: { ...clip.transitionIn, durationInFrames: edge(clip.transitionIn.durationInFrames) },
    transitionOut: { ...clip.transitionOut, durationInFrames: edge(clip.transitionOut.durationInFrames) },
    junction: clip.junction && { ...clip.junction, durationInFrames: Math.min(MAX_JUNCTION_FRAMES, Math.max(MIN_JUNCTION_FRAMES, scale(clip.junction.durationInFrames))) },
    keyframes: rescaled(clip.keyframes, scale),
    path: clip.path && { ...clip.path, tangents: byFrame(clip.path.tangents.map((t) => ({ ...t, frame: scale(t.frame) }))) },
    markers: markersAt(clip.markers, scale)
  };
}

const tracksAt = (tracks: MotionTrack[], scale: Scale) => tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => retimed(c, scale)) }));

const compAt = (comp: MotionComp, scale: Scale): MotionComp => ({ ...comp, durationInFrames: Math.max(1, scale(comp.durationInFrames)), tracks: tracksAt(comp.tracks, scale) });

export function retimer(fromFps: number, toFps: number) {
  const scale: Scale = (frame) => Math.round((frame * toFps) / fromFps);
  return { frame: scale, clip: (clip: MotionClip) => retimed(clip, scale), comp: (comp: MotionComp) => compAt(comp, scale) };
}

export function setFrameRate(doc: MotionDoc, fps: FrameRate): OpResult {
  if (!FRAME_RATES.includes(fps)) {
    return { ok: false, error: `frame rate must be one of ${FRAME_RATES.join(', ')}` };
  }
  const scale = retimer(doc.fps, fps).frame;
  const camera = doc.camera ? { ...doc.camera, keyframes: rescaled(doc.camera.keyframes as Keyframes, scale) } : null;

  return {
    ok: true,
    doc: {
      ...doc,
      fps,
      durationInFrames: Math.min(maxFrames(fps), Math.max(1, scale(doc.durationInFrames))),
      tracks: tracksAt(doc.tracks, scale),
      comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, compAt(comp, scale)])),
      markers: markersAt(doc.markers, scale),
      workArea: doc.workArea && { from: scale(doc.workArea.from), to: Math.max(1, scale(doc.workArea.to)) },
      camera,
      look: doc.look && { ...doc.look, lights: doc.look.lights.map((l) => ({ ...l, keyframes: rescaled(l.keyframes as Keyframes, scale) })) }
    }
  };
}
