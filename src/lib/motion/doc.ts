import { z } from 'zod';
import { COMPONENT_IDS, TrackKind, parseProps, type ComponentId } from './components';
import { FPS, TRANSITION_KINDS, TransitionKind } from './design';
import { keyframeSchema, keyframesProblem, transformSchema } from './keyframes';

export enum MotionFormat {
  Landscape = '16:9',
  Vertical = '9:16',
  Square = '1:1',
  Portrait = '4:5'
}

export const FORMATS: Record<MotionFormat, { width: number; height: number; label: string }> = {
  [MotionFormat.Landscape]: { width: 1920, height: 1080, label: '16:9' },
  [MotionFormat.Vertical]: { width: 1080, height: 1920, label: '9:16' },
  [MotionFormat.Square]: { width: 1080, height: 1080, label: '1:1' },
  [MotionFormat.Portrait]: { width: 1080, height: 1350, label: '4:5' }
};

export const MOTION_FORMATS = Object.values(MotionFormat) as [MotionFormat, ...MotionFormat[]];

export const MAX_SECONDS = 60;
export const MAX_FRAMES = MAX_SECONDS * FPS;
export const MAX_SIDE = 1920;
export const MAX_SHORT_SIDE = 1080;
export const DEFAULT_SECONDS = 15;
export const DOC_VERSION = 2;

const edgeSchema = z.object({
  kind: z.enum(TRANSITION_KINDS),
  durationInFrames: z.number().int().min(0).max(FPS * 2)
});

const clipSchema = z.object({
  id: z.string().min(1),
  from: z.number().int().min(0).max(MAX_FRAMES),
  durationInFrames: z.number().int().min(1).max(MAX_FRAMES),
  trimStart: z.number().int().min(0).default(0),
  component: z.enum(COMPONENT_IDS),
  props: z.record(z.string(), z.unknown()).default({}),
  transitionIn: edgeSchema.default({ kind: TransitionKind.None, durationInFrames: 0 }),
  transitionOut: edgeSchema.default({ kind: TransitionKind.None, durationInFrames: 0 }),
  transform: transformSchema.default({}),
  keyframes: z.record(z.string(), z.array(keyframeSchema).min(1)).default({})
});

const trackSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([TrackKind.Visual, TrackKind.Audio]),
  name: z.string().max(60).default(''),
  clips: z.array(clipSchema)
});

const assetRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['image', 'video', 'audio', 'model3d']),
  name: z.string().max(200).default('')
});

export const motionDocSchema = z
  .object({
    version: z.literal(DOC_VERSION),
    fps: z.literal(FPS),
    width: z.number().int().min(16).max(MAX_SIDE),
    height: z.number().int().min(16).max(MAX_SIDE),
    durationInFrames: z.number().int().min(1).max(MAX_FRAMES),
    tracks: z.array(trackSchema).max(20),
    assets: z.array(assetRefSchema).default([])
  })
  .refine((d) => Math.min(d.width, d.height) <= MAX_SHORT_SIDE, 'resolution above 1080p');

export type MotionDoc = z.infer<typeof motionDocSchema>;
export type MotionTrack = MotionDoc['tracks'][number];
export type MotionClip = Omit<MotionTrack['clips'][number], 'component'> & { component: ComponentId };
export type AssetRef = MotionDoc['assets'][number];

export type DocVerdict = { ok: true; doc: MotionDoc } | { ok: false; error: string };

type Raw = Record<string, unknown> & { tracks?: { clips?: Record<string, unknown>[] }[] };

const MIGRATIONS: Record<number, (doc: Raw) => Raw> = {
  1: (doc) => ({
    ...doc,
    version: 2,
    tracks: (doc.tracks ?? []).map((t) => ({ ...t, clips: (t.clips ?? []).map((c) => ({ transform: {}, keyframes: {}, ...c })) }))
  })
};

export function upgradeDoc(input: unknown): unknown {
  if (!input || typeof input !== 'object') {
    return input;
  }
  let doc = input as Raw;
  let version = typeof doc.version === 'number' ? doc.version : 1;
  while (MIGRATIONS[version]) {
    doc = MIGRATIONS[version](doc);
    version += 1;
  }
  return doc;
}

export function byFrame<T extends { frame: number }>(track: readonly T[]): T[] {
  const last = new Map(track.map((k) => [k.frame, k]));
  return [...last.values()].sort((a, b) => a.frame - b.frame);
}

function clipProblem(clip: MotionClip): string | null {
  const verdict = parseProps(clip.component, clip.props);
  if (!verdict.ok) {
    return verdict.error;
  }
  clip.props = verdict.props;
  clip.keyframes = Object.fromEntries(Object.entries(clip.keyframes).map(([key, track]) => [key, byFrame(track)]));
  return keyframesProblem(clip.component, clip.keyframes);
}

function propsProblem(doc: MotionDoc): string | null {
  for (const clip of clipsOf(doc)) {
    const problem = clipProblem(clip);
    if (problem) {
      return problem;
    }
  }
  return null;
}

export function parseMotionDoc(input: unknown): DocVerdict {
  const parsed = motionDocSchema.safeParse(upgradeDoc(input));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }

  const doc = structuredClone(parsed.data);
  const problem = propsProblem(doc);
  if (problem) {
    return { ok: false, error: problem };
  }
  return { ok: true, doc };
}

export function newMotionDoc(format: MotionFormat): MotionDoc {
  const { width, height } = FORMATS[format];
  return {
    version: DOC_VERSION,
    fps: FPS,
    width,
    height,
    durationInFrames: DEFAULT_SECONDS * FPS,
    tracks: [
      { id: 'v1', kind: TrackKind.Visual, name: 'Video 1', clips: [] },
      { id: 'a1', kind: TrackKind.Audio, name: 'Audio 1', clips: [] }
    ],
    assets: []
  };
}

export function formatOf(doc: Pick<MotionDoc, 'width' | 'height'>): MotionFormat {
  const match = MOTION_FORMATS.find((f) => FORMATS[f].width === doc.width && FORMATS[f].height === doc.height);
  return match ?? MotionFormat.Landscape;
}

export function clipsOf(doc: MotionDoc): MotionClip[] {
  return doc.tracks.flatMap((t) => t.clips as MotionClip[]);
}

export function findClip(doc: MotionDoc, clipId: string): { track: MotionTrack; clip: MotionClip } | null {
  for (const track of doc.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) {
      return { track, clip: clip as MotionClip };
    }
  }
  return null;
}
