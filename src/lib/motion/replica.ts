import { FORMATS, MAX_SECONDS, MotionFormat, type MotionDoc } from './doc';
import { setCanvas } from './timeline';

export enum VideoKind {
  Standard = 'standard',
  Replica = 'replica'
}

const REPLICA_ASK = /\b(recreat|replicat|remak|reproduc|clon|ricrea|rifai|replica|recrea|rehaz|recrée|recréer|refai|nachbau)\w*/i;

export const asksReplica = (message: string) => REPLICA_ASK.test(message);

export function replicaSource(turn: { message: string; videoId: string | undefined; replicaOf: string | undefined }): string | null {
  if (turn.replicaOf) {
    return turn.replicaOf;
  }
  return turn.videoId && asksReplica(turn.message) ? turn.videoId : null;
}

export const kindOf = (replicaOf: string | null | undefined) => (replicaOf ? VideoKind.Replica : VideoKind.Standard);

const KIT_TOOLS: ReadonlySet<string> = new Set(['list_templates', 'get_template', 'add_template', 'set_template_fields', 'list_shots', 'add_shot', 'add_ui', 'ui_morph_reel', 'apply_layout', 'list_layouts', 'apply_text_preset', 'apply_shape_preset']);

const OFFERED: Record<VideoKind, (name: string) => boolean> = {
  [VideoKind.Standard]: () => true,
  [VideoKind.Replica]: (name) => !KIT_TOOLS.has(name)
};

export const kindTools = (kind: VideoKind, names: readonly string[]) => names.filter(OFFERED[kind]);

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

export const CLOSE_TO_REFERENCE = 0.9;

export type FrameSpan = { from: number; to: number };

type Placed = { id: string; from: number; durationInFrames: number };

const clipsOf = (doc: MotionDoc) => new Map(doc.tracks.flatMap((t) => (t.clips as Placed[]).map((c) => [c.id, c] as const)));

export const spanFrames = (span: { fromS: number; toS: number }, fps: number): FrameSpan => ({ from: Math.round(span.fromS * fps), to: Math.round(span.toS * fps) });

export function lockBreach(before: MotionDoc, after: MotionDoc, span: FrameSpan): string | null {
  const old = clipsOf(before);
  const now = clipsOf(after);
  const locked = [...old.values()].filter((c) => c.from + c.durationInFrames <= span.from);
  const touched = locked.filter((c) => JSON.stringify(now.get(c.id)) !== JSON.stringify(c));
  if (touched.length) {
    return `${touched.map((c) => c.id).join(', ')} belong to an earlier scene, which is locked: edit only frames ${span.from}–${span.to}`;
  }
  const outside = [...now.values()].filter((c) => !old.has(c.id) && (c.from < span.from || c.from >= span.to));
  return outside.length ? `${outside.map((c) => c.id).join(', ')} start outside the current scene (frames ${span.from}–${span.to}): build only this scene` : null;
}

export const REPLICA_COMPARE = `After each scene, call compare_to_reference: it draws your frames at the reference times and scores each scene 0–1 against the reference. Fix the lowest scene and compare again until every scene scores ${CLOSE_TO_REFERENCE} or more, or the budget ends.`;

export const REPLICA_BRIEF = [
  'This is a remake of the attached reference video: the breakdown and the reference frames above are the plan, so do not write a new script or storyboard — build.',
  'Compose every scene from what the reference frames show, not from the text: no templates, shots, kit UI or presets (they are not offered). Place each element at the position and size it has in the frame (as a share of the width and height), with the exact hex colours, and the closest Google Font to the lettering you see.',
  'The canvas already has the reference format and duration: keep them.',
  'Build it scene by scene from the breakdown: each scene starts and ends at the reference timings, with its on-screen text verbatim.',
  'Use the reference palette as exact hex colours and gradients (a radial vignette stays a radial gradient, a red scene stays red).',
  'Match the type scale: when the reference text fills the frame, set it huge, bold and condensed, edge to edge — never a small title in a box.',
  'Recreate each transition and camera move the breakdown names (push, pan, 3D turn, whip, blur sweep) instead of a plain cut.',
  'No span may be empty or black unless the reference is: the first frame already shows the first scene. View one frame per reference scene before you finish.'
].join('\n');
