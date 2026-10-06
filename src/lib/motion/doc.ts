import { z } from 'zod';
import { COMP_CARD, COMP_CARD_LAYOUTS } from './card-layouts';
import { COMPONENT_IDS, CUSTOM_NAME, TrackKind, parseProps, type ComponentId, type PropsVerdict } from './components';
import { withParams } from './custom/params';
import { MAX_COMPONENTS, Strictness, customComponentSchema, customValues, type CustomComponents } from './custom/component';
import { junctionSchema } from './junction-model';
import { FASTEST_RATE, FPS, FRAME_RATES, MAX_SECONDS, TRANSITION_KINDS, TransitionKind, maxFrames } from './design';
import { motionPathSchema } from './path';
import { keyframeSchema, keyframesProblem, transformSchema } from './keyframes';
import { MATTES, Matte, maskSchema, maskStackSchema } from './mask';
import { lookSchema } from './look';
import { DEPTH, SPACES, Space, cameraSchema, depthSchema } from './camera';
import { PARENT_OPACITIES, ParentOpacity, parentProblem } from './parent';
import { expressionsSchema, expressionsProblem } from './expression/schema';
import { fontRefProblem, fontsSchema, usedFaces } from './fonts/model';
import { effectsSchema, effectsProblem } from './effects/model';
import { BLEND_MODES, BlendMode } from './blend';
import { animatorsSchema } from './text-animators/model';
import { textPathSchema } from './text-path/model';
import { DEFAULT_MOTION_BLUR, motionBlurSchema } from './motion-blur';
import { interactiveSchema } from './interactive/schema';
import { fieldsSchema } from './template/field-model';
import { physicsSchema } from './physics/model';

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

export { MAX_SECONDS };
const FRAMES_CEILING = maxFrames(FASTEST_RATE);
export const MAX_SIDE = 1920;
export const MAX_SHORT_SIDE = 1080;
export const DEFAULT_SECONDS = 15;
export const DOC_VERSION = 5;

export enum Background {
  Brand = 'brand',
  Transparent = 'transparent'
}

const edgeSchema = z.object({
  kind: z.enum(TRANSITION_KINDS),
  durationInFrames: z.number().int().min(0).max(FASTEST_RATE * 2)
});

export const MAX_MARKERS = 100;

export const markerSchema = z.object({ frame: z.number().int().min(0), label: z.string().min(1).max(40) });

export type Marker = z.infer<typeof markerSchema>;

const clipSchema = z.object({
  id: z.string().min(1),
  from: z.number().int().min(0).max(FRAMES_CEILING),
  durationInFrames: z.number().int().min(1).max(FRAMES_CEILING),
  trimStart: z.number().int().min(0).default(0),
  component: z.enum(COMPONENT_IDS),
  props: z.record(z.string(), z.unknown()).default({}),
  transitionIn: edgeSchema.default({ kind: TransitionKind.None, durationInFrames: 0 }),
  transitionOut: edgeSchema.default({ kind: TransitionKind.None, durationInFrames: 0 }),
  junction: junctionSchema.nullable().optional(),
  transform: transformSchema.default({}),
  keyframes: z.record(z.string(), z.array(keyframeSchema).min(1)).default({}),
  mask: maskSchema.nullable().default(null),
  maskStack: maskStackSchema.default([]),
  matte: z.enum(MATTES).default(Matte.None),
  depth: depthSchema.default(DEPTH.fallback),
  space: z.enum(SPACES).default(Space.World),
  parent: z.string().min(1).nullable().default(null),
  parentOpacity: z.enum(PARENT_OPACITIES).default(ParentOpacity.Inherit),
  expressions: expressionsSchema,
  effects: effectsSchema,
  blend: z.enum(BLEND_MODES).default(BlendMode.Normal),
  animators: animatorsSchema,
  textPath: textPathSchema.nullable().default(null),
  motionBlur: z.boolean().default(true),
  path: motionPathSchema.nullable().default(null),
  physics: physicsSchema.nullable().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  markers: z.array(markerSchema).max(MAX_MARKERS).optional()
});

const trackSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([TrackKind.Visual, TrackKind.Audio]),
  name: z.string().max(60).default(''),
  clips: z.array(clipSchema),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional()
});

export const MAX_TRACKS = 20;

const templateMarkSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(60),
  keys: z.record(z.string(), z.string()).default({})
});

const compSchema = z.object({
  template: templateMarkSchema.optional(),
  name: z.string().min(1).max(60),
  durationInFrames: z.number().int().min(1).max(FRAMES_CEILING),
  frame: z.object({ width: z.number().int().min(16).max(MAX_SIDE), height: z.number().int().min(16).max(MAX_SIDE) }).optional(),
  background: z.enum([Background.Brand, Background.Transparent]).optional(),
  tracks: z
    .array(trackSchema)
    .max(MAX_TRACKS)
    .refine((tracks) => tracks.every((t) => t.kind === TrackKind.Visual), 'a composition holds video tracks only')
});

const assetRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['image', 'video', 'audio', 'model3d', 'font']),
  name: z.string().max(200).default('')
});

export const motionDocSchema = z
  .object({
    version: z.literal(DOC_VERSION),
    fps: z.literal(FRAME_RATES).default(FPS),
    width: z.number().int().min(16).max(MAX_SIDE),
    height: z.number().int().min(16).max(MAX_SIDE),
    durationInFrames: z.number().int().min(1).max(FRAMES_CEILING),
    tracks: z.array(trackSchema).max(MAX_TRACKS),
    comps: z.record(z.string().min(1), compSchema).default({}),
    assets: z.array(assetRefSchema).default([]),
    camera: cameraSchema.nullable().default(null),
    look: lookSchema.nullable().default(null),
    fonts: fontsSchema,
    background: z.enum([Background.Brand, Background.Transparent]).default(Background.Brand),
    motionBlur: motionBlurSchema,
    fields: fieldsSchema,
    components: z
      .record(z.string().regex(CUSTOM_NAME, 'component names are PascalCase, e.g. NodeGraph'), customComponentSchema)
      .refine((c) => Object.keys(c).length <= MAX_COMPONENTS, `at most ${MAX_COMPONENTS} custom components`)
      .default({}),
    markers: z.array(markerSchema).max(MAX_MARKERS).optional(),
    workArea: z.object({ from: z.number().int().min(0), to: z.number().int().min(1) }).nullable().optional(),
    interactive: interactiveSchema.optional()
  })
  .refine((d) => Math.min(d.width, d.height) <= MAX_SHORT_SIDE, 'resolution above 1080p')
  .refine((d) => d.durationInFrames <= maxFrames(d.fps), { message: `the video can be at most ${MAX_SECONDS} seconds`, path: ['durationInFrames'] });

export type MotionDoc = z.infer<typeof motionDocSchema>;
export type MotionTrack = MotionDoc['tracks'][number];
export type MotionClip = Omit<MotionTrack['clips'][number], 'component'> & { component: ComponentId };
export type AssetRef = MotionDoc['assets'][number];
export type MotionComp = MotionDoc['comps'][string];
export type TemplateMark = NonNullable<MotionComp['template']>;

export type DocVerdict = { ok: true; doc: MotionDoc } | { ok: false; error: string };

type Raw = Record<string, unknown> & { tracks?: { clips?: Record<string, unknown>[] }[] };

const withClips = (doc: Raw, version: number, defaults: Record<string, unknown>): Raw => ({
  ...doc,
  version,
  tracks: (doc.tracks ?? []).map((t) => ({ ...t, clips: (t.clips ?? []).map((c) => ({ ...defaults, ...c })) }))
});

const MIGRATIONS: Record<number, (doc: Raw) => Raw> = {
  1: (doc) => withClips(doc, 2, { transform: {}, keyframes: {} }),
  2: (doc) => withClips(doc, 3, { mask: null, matte: Matte.None }),
  3: (doc) => ({ camera: null, ...withClips(doc, 4, { depth: DEPTH.fallback, space: Space.World }) }),
  4: (doc) => withClips(doc, 5, { parent: null, parentOpacity: ParentOpacity.Inherit })
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

export function clipProps(components: CustomComponents, component: ComponentId, props: unknown, strictness: Strictness): PropsVerdict {
  const base = parseProps(component, props);
  if (!base.ok || component !== 'Custom') {
    return base;
  }
  const { name, ...given } = base.props as { name: string };
  const custom = components[name];
  if (!custom) {
    const known = Object.keys(components);
    return { ok: false, error: `no custom component ${name}: write_component first${known.length ? `; this video has ${known.join(', ')}` : ''}` };
  }
  const values = customValues(custom, given, strictness);
  return values.ok ? { ok: true, props: { name, ...values.values } } : { ok: false, error: `${name}: ${values.error}` };
}

function clipProblem(doc: MotionDoc, clip: MotionClip): string | null {
  const verdict = clipProps(doc.components, clip.component, clip.props, Strictness.Lenient);
  if (!verdict.ok) {
    return verdict.error;
  }
  clip.props = verdict.props;
  clip.keyframes = Object.fromEntries(Object.entries(clip.keyframes).map(([key, track]) => [key, byFrame(track)]));
  return effectsProblem(clip.effects) ?? keyframesProblem(withParams(doc, clip)) ?? expressionsProblem(withParams(doc, clip));
}

function propsProblem(doc: MotionDoc): string | null {
  for (const clip of everyClip(doc)) {
    const problem = clipProblem(doc, clip);
    if (problem) {
      return problem;
    }
  }
  return null;
}

function fontsProblem(doc: MotionDoc): string | null {
  for (const face of usedFaces(doc)) {
    const problem = fontRefProblem(face.family, doc.fonts);
    if (problem) {
      return problem;
    }
  }
  return null;
}

export function compOf(clip: Pick<MotionClip, 'component' | 'props'>): string | null {
  return clip.component === 'Precomp' ? String(clip.props.comp) : null;
}

type CompositionCard = { assetId: string; kind: string };

export function compsOf(clip: Pick<MotionClip, 'component' | 'props'>): string[] {
  if (clip.component === 'Composition') {
    return !COMP_CARD_LAYOUTS.has(clip.props.layout) ? [] : ((clip.props.media ?? []) as CompositionCard[]).filter((m) => m.kind === COMP_CARD).map((m) => m.assetId);
  }
  const id = compOf(clip);
  return id === null ? [] : [id];
}

function compsUsed(tracks: readonly MotionTrack[]): string[] {
  return tracks.flatMap((t) => (t.clips as MotionClip[]).flatMap(compsOf));
}

export function compRefProblem(doc: Pick<MotionDoc, 'comps'>, clip: Pick<MotionClip, 'component' | 'props'>): string | null {
  const id = compsOf(clip).find((ref) => !doc.comps[ref]);
  if (id === undefined) {
    return null;
  }
  const known = Object.keys(doc.comps);
  return `no composition ${id}${known.length ? `: this video has ${known.join(', ')}` : ': precompose clips first'}`;
}

function cycleFrom(doc: MotionDoc, id: string, trail: readonly string[]): string | null {
  if (trail.includes(id)) {
    return `composition ${id} contains itself`;
  }
  for (const next of compsUsed(doc.comps[id]?.tracks ?? [])) {
    const problem = cycleFrom(doc, next, [...trail, id]);
    if (problem) {
      return problem;
    }
  }
  return null;
}

function compsProblem(doc: MotionDoc): string | null {
  for (const clip of everyClip(doc)) {
    const problem = compRefProblem(doc, clip);
    if (problem) {
      return problem;
    }
  }
  for (const [id, comp] of Object.entries(doc.comps)) {
    const problem = parentProblem({ ...doc, tracks: comp.tracks }) ?? cycleFrom(doc, id, []);
    if (problem) {
      return problem;
    }
  }
  return null;
}

export function fontsOfClip(doc: MotionDoc, clip: Pick<MotionClip, 'component' | 'props'>): string | null {
  return fontsProblem({ ...doc, tracks: [{ id: '', kind: TrackKind.Visual, name: '', clips: [clip as MotionClip] }] });
}

export function cloneDoc<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

export function parseMotionDoc(input: unknown): DocVerdict {
  const parsed = motionDocSchema.safeParse(upgradeDoc(input));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }

  const doc = cloneDoc(parsed.data);
  const problem = parentProblem(doc) ?? compsProblem(doc) ?? propsProblem(doc) ?? fontsProblem(doc);
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
    comps: {},
    assets: [],
    camera: null,
    look: null,
    fonts: [],
    background: Background.Brand,
    motionBlur: DEFAULT_MOTION_BLUR,
    fields: [],
    components: {}
  };
}

const STILL = { kind: TransitionKind.None, durationInFrames: 0 };

export function newClip(fields: Pick<MotionClip, 'id' | 'from' | 'durationInFrames' | 'component' | 'props'> & Partial<MotionClip>): MotionClip {
  return {
    trimStart: 0,
    transitionIn: STILL,
    transitionOut: STILL,
    transform: {},
    keyframes: {},
    mask: null,
    maskStack: [],
    matte: Matte.None,
    depth: DEPTH.fallback,
    space: Space.World,
    parent: null,
    parentOpacity: ParentOpacity.Inherit,
    expressions: {},
    effects: [],
    blend: BlendMode.Normal,
    animators: [],
    textPath: null,
    motionBlur: true,
    path: null,
    ...fields
  };
}

export function formatOf(doc: Pick<MotionDoc, 'width' | 'height'>): MotionFormat {
  const match = MOTION_FORMATS.find((f) => FORMATS[f].width === doc.width && FORMATS[f].height === doc.height);
  return match ?? MotionFormat.Landscape;
}

export function clipsOf(doc: MotionDoc): MotionClip[] {
  return doc.tracks.flatMap((t) => t.clips as MotionClip[]);
}

export function everyClip(doc: Pick<MotionDoc, 'tracks' | 'comps'>): MotionClip[] {
  return [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)].flatMap((tracks) => tracks.flatMap((t) => t.clips as MotionClip[]));
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
