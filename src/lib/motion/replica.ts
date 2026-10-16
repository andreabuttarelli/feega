import { FORMATS, MAX_SECONDS, MotionFormat, type MotionDoc } from './doc';
import { setCanvas } from './timeline';

export enum VideoKind {
  Standard = 'standard',
  Replica = 'replica'
}

const REPLICA_ASK = /\b(recreat|replicat|remak|reproduc|clon|ricrea|rifai|replica|recrea|rehaz|recrée|recréer|refai|nachbau)\w*/i;

export const asksReplica = (message: string) => REPLICA_ASK.test(message);

export function videoKindOf(turn: { message: string; videoAttached: boolean; stored: VideoKind | undefined }): VideoKind {
  if (turn.stored === VideoKind.Replica) {
    return VideoKind.Replica;
  }
  return turn.videoAttached && asksReplica(turn.message) ? VideoKind.Replica : VideoKind.Standard;
}

const REPLICA_FORMATS = [MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square, MotionFormat.Portrait] as const;

const ratioOf = (size: { width: number; height: number }) => size.width / size.height;

export function replicaFormat(size: { width: number; height: number }): MotionFormat {
  const ratio = ratioOf(size);
  return REPLICA_FORMATS.reduce((best, f) => (Math.abs(Math.log(ratioOf(FORMATS[f]) / ratio)) < Math.abs(Math.log(ratioOf(FORMATS[best]) / ratio)) ? f : best));
}

export type ReplicaCanvas = { format: MotionFormat; durationS: number };

const built = (doc: MotionDoc) => doc.tracks.some((t) => t.clips.length > 0);

export function replicaCanvas(doc: MotionDoc, ref: ReplicaCanvas): MotionDoc | null {
  if (built(doc)) {
    return null;
  }
  const seconds = Math.min(MAX_SECONDS, Math.max(1, ref.durationS));
  const sized = setCanvas(doc, { format: ref.format, durationInFrames: Math.round(seconds * doc.fps) });
  return sized.ok ? sized.doc : null;
}

export const REPLICA_BRIEF = [
  'This is a remake of the attached reference video: the breakdown above is the plan, so do not write a new script or storyboard — build.',
  'The canvas already has the reference format and duration: keep them.',
  'Build it scene by scene from the breakdown: each scene starts and ends at the reference timings, with its on-screen text verbatim.',
  'Use the reference palette as exact hex colours and gradients (a radial vignette stays a radial gradient, a red scene stays red).',
  'Match the type scale: when the reference text fills the frame, set it huge, bold and condensed, edge to edge — never a small title in a box.',
  'Recreate each transition and camera move the breakdown names (push, pan, 3D turn, whip, blur sweep) instead of a plain cut.',
  'No span may be empty or black unless the reference is: the first frame already shows the first scene. View one frame per reference scene before you finish.'
].join('\n');
