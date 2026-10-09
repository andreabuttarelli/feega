import { THREE_GUIDANCE } from './three-guidance';
import { tool, type Tool, type ToolExecutionOptions } from 'ai';
import { addShader, removeShader, setShader } from '$lib/motion/shaders/ops';
import type { EffectStore } from '$lib/server/effects/store';
import type { LayoutStore } from '$lib/server/layouts/store';
import type { LayoutWritten } from '$lib/server/repos/layouts';
import { LAYOUT_SPEC_GUIDE } from '$lib/server/layouts/design';
import { CUSTOM_LAYOUT } from '$lib/canvas/composition/index';
import { CheckState as EffectCheck, Outcome, type Written } from '$lib/server/repos/effects';

const MAX_EFFECT_FAILURES = 3;
import { addAdjustment, createComp, mergeView, precompose, viewOf } from '$lib/motion/precomp';
import { z } from 'zod';
import { AssetKind, COMPONENTS, COMPONENT_IDS, TrackKind, type ComponentId } from '$lib/motion/components';
import { fieldsOf } from '$lib/motion/inspector';
import { Ease, FRAME_RATES, MAX_SECONDS, TRANSITION_KINDS } from '$lib/motion/design';
import { setFrameRate } from '$lib/motion/frame-rate';
import { Background, MAX_SIDE, MOTION_FORMATS, clipsOf, findClip, type MotionDoc } from '$lib/motion/doc';
import { JUNCTION, JUNCTION_KINDS, junctionPairs } from '$lib/motion/junctions';
import { ClipEdge, Side, addClip, addTrack, moveClip, moveTrack, removeClips, removeTrack, renameTrack, removeAsset, removeKeyframes, setCanvas, setKeyInterp, setKeyframes, setMask, setMaskStack, shaped, setProps, setTiming, setTrackMatte, setTransform, setTransition, setJunction, trimClip, applyEasePreset, setKeyEase, type OpResult } from '$lib/motion/timeline';
import { MASK_KEYS, MASK_KIND_IDS, MASK_MODES, MATTES, MAX_MASK_STACK } from '$lib/motion/mask';
import { pathProblem } from '$lib/motion/path';
import { Align, addMarker, alignClips, allMarkers, distributeClips, markerFrame, nudgeClips, removeMarker, sequenceClips, setClipFlags, setTrackFlags, setWorkArea, staggerClips } from '$lib/motion/organize';

const ARRANGE_OPS = ['nudge', 'sequence', 'stagger', 'align_start', 'align_end', 'distribute'] as const;

const ARRANGE: Record<(typeof ARRANGE_OPS)[number], (doc: MotionDoc, ids: string[], amount: number) => OpResult> = {
  nudge: (doc, ids, amount) => nudgeClips(doc, ids, amount),
  sequence: (doc, ids, amount) => sequenceClips(doc, ids, amount),
  stagger: (doc, ids, amount) => staggerClips(doc, ids, amount),
  align_start: (doc, ids) => alignClips(doc, ids, Align.Start),
  align_end: (doc, ids) => alignClips(doc, ids, Align.End),
  distribute: (doc, ids) => distributeClips(doc, ids)
};
import { setMotionPath, setPathTangent } from '$lib/motion/path-ops';
import { EASE_PRESETS, EASE_PRESET_IDS, easeHandles, withHandles } from '$lib/motion/graph';
import { ANIMATABLE, INTERPS, Interp, SPATIAL_KEYS, TRANSFORM_KEYS, ValueKind, easeSchema, type Keyframe } from '$lib/motion/keyframes';
import type { MotionAsset } from './editor';
import { MAX_FRAMES_PER_VIEW, MAX_VIEWS_PER_TURN, VIEW_FRAMES, type Frame } from './frames';
import { contentEnd, fitDuration } from '$lib/motion/fit-duration';
import { blocking, docProblems, frameProblems, softPictures, type FrameStat, type Pixels, type QualityProblem } from '$lib/motion/direction';
import { CheckState, ComponentMode, MAX_CSS, MAX_HTML, MAX_JS, SOURCE_FILES, checkState, modeOf, propsSchemaSchema, sourceHash, type CustomComponent } from '$lib/motion/custom/component';
import { patchComponent, recordCheck, removeComponent, writeComponent } from '$lib/motion/custom/ops';
import { RECREATE_STATES, UI_KINDS, UI_KIT, recreatedStyle, recreatedUi, type UiStructure } from '$lib/motion/ui-kit/kit';
import { MORPH_KINDS, DEFAULT_REEL } from '$lib/motion/ui-morph/reel';
import { addMorphReel } from '$lib/motion/ui-morph/ops';
import { STORY_BEATS, STORY_SHARE, markStory } from '$lib/motion/story';
import { anchorsOf } from '$lib/motion/clicks';
import { clickUi } from '$lib/motion/cursor-ops';
import { Isolate, focusUi } from '$lib/motion/ui-focus';
import { ACTS, BrandKind, briefOf, scriptProblems, scriptSchema, sourcesOf, type LaunchScript } from '$lib/motion/script';
import { quoted, type SitePage } from './site-copy';
import { MediaKind, boardMedia, outlineOf, storyboardSchema, type Storyboard, type StoryboardRead } from '$lib/motion/storyboard';
import { PATCH_COMPONENT, READ_COMPONENT, WRITE_COMPONENT } from './model-route';
import { CAMERA, CAMERA_KEYS, CAMERA_LANE, SPACES, type Camera } from '$lib/motion/camera';
import { ENV_PRESETS, HDRI, LIGHT, envPresetInput, LIGHT_KEYS, LIGHT_KINDS, type Look } from '$lib/motion/look';
import { removeLight, removeLook, setLight, setLightKeyframes, setLook } from '$lib/motion/look-ops';
import { DEVICE, DEVICES } from '$lib/motion/devices';
import { DEVICE_PRESETS, PRESET as DEVICE_PRESET, addDeviceRow, applyDevicePreset } from '$lib/motion/device-presets';
import { CAMERA_PRESETS, PRESETS, applyPreset, removeCamera, setCamera, setCameraKeyframes, setClipDepth } from '$lib/motion/camera-ops';
import { ParentOpacity } from '$lib/motion/parent';
import { addNull, nullFromSelection, setParent, setParentOpacity } from '$lib/motion/parent-ops';
import { setCameraExpression, setExpression } from '$lib/motion/expression/ops';
import { EXPRESSION_GUIDE } from '$lib/motion/expression/guide';
import { INTERACTIVE_PRESETS, PRESET, applyInteractivePreset, setInteractive } from '$lib/motion/interactive/presets';
import { OUTSIDES, PLAY_MODES, SCROLL_LENGTH, interactiveOf } from '$lib/motion/interactive/settings';
import { interactiveSchema } from '$lib/motion/interactive/schema';
import { liveLanes } from '$lib/motion/interactive/spec';
import { fileSnippet } from '$lib/motion/interactive/bundle';
import { flattenComps } from '$lib/motion/precomp';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { BuiltinFont, FONT_WEIGHTS, fontRefProblem, searchFonts } from '$lib/motion/fonts/model';
import { registerFont, removeFont, setFont } from '$lib/motion/fonts/ops';
import { EFFECTS, EFFECT_KINDS } from '$lib/motion/effects/registry';
import { addEffect, removeEffect, setEffect } from '$lib/motion/effects/ops';
import { MAX_EFFECTS, effectKey } from '$lib/motion/effects/model';
import { EffectKind } from '$lib/motion/effects/registry';
import { LUT_PRESETS, LUT_PRESET_IDS, applyLut, compileLut, lutFromCube } from '$lib/motion/effects/lut';
import { BLEND_MODES } from '$lib/motion/blend';
import { ANIMATOR_UNITS, SELECTOR_SHAPES, SELECTOR_KEYS, VALUES, VALUE_KEYS, animatorKey } from '$lib/motion/text-animators/model';
import { PATH_ALIGNS, PATH_PRESETS, PathSourceKind, TEXT_PATH, TEXT_PATH_KEYS, textPathKey, type PathSource } from '$lib/motion/text-path/model';
import { removeTextPath, setTextPath } from '$lib/motion/text-path/ops';
import { PRESETS as TEXT_PRESET_SPECS, TEXT_PRESETS, addAnimator, applyPreset as applyTextPreset, removeAnimator, setAnimator } from '$lib/motion/text-animators/ops';
import { setBlendMode } from '$lib/motion/blend-ops';
import { setClipsBlur, setMotionBlur } from '$lib/motion/motion-blur-ops';
import { DEGREES, MAX_SAMPLES } from '$lib/motion/motion-blur';
import { MODIFIERS, MODIFIER_KINDS } from '$lib/motion/shape/modifiers';
import { addModifier, morphTo, removeModifier, setModifier, setPath } from '$lib/motion/shape/ops';
import { SHAPE_KINDS, StrokeKind, modifierKey } from '$lib/motion/shape/schema';
import { PRESET as SHAPE_PRESET, SHAPE_PRESETS, applyShapePreset } from '$lib/motion/shape/presets';
import { MAX_RATE, MIN_RATE, REMAP_KEY, clearTimeRemap, freezeFrame } from '$lib/motion/time-remap';
import { PARTICLE_PRESETS, PRESET_PROPS as PARTICLE_PRESET, applyParticlePreset } from '$lib/motion/particles/presets';
import { Lens, addLens } from '$lib/motion/glass/ops';
import { SPRINGS } from '$lib/motion/spring';
import { BLOB_INPUT } from '$lib/motion/blob/inputs';
import { BLOB_NUMBER_KEYS, MAX_DROPS } from '$lib/motion/blob/model';
import { DUCK_DEFAULTS, duckUnder } from '$lib/motion/duck';
import type { AudioAnalysis } from '$lib/motion/audio-analysis';
import { Division, Hit, cutToBeat, hitFrames, markHits } from '$lib/motion/beats';
import { Mood } from '$lib/motion/music-library';
import { INSTRUMENTS, eventSchema, soundScoreSchema, voiceSchema, type SoundScore } from '$lib/motion/sound/score';
import { laySound } from '$lib/motion/sound/lay';
import { PULSE_PROPS, pulseWithMusic } from '$lib/motion/pulse';
import { applyValues, exposeField, fieldValues, removeField } from '$lib/motion/template/fields';
import { FIELD_TYPES, MAX_LINKED, type ExposedField } from '$lib/motion/template/field-model';
import { detachTemplate, insertTemplate, isLockedComp, setTemplateValues, templateFields } from '$lib/motion/template/library';
import type { TemplateLibrary } from './templates';
import { createWebTools, type WebToolDeps } from '$lib/server/web/web-tools';
import { DEFAULT_NAME_PATTERN, MAX_BATCH_ROWS, outputName } from '$lib/motion/template/batch';
import { renderQuote } from '$lib/motion/render-quote';
import { BOUNDS, PHYSICS, PHYSICS_KEYS, PHYSICS_PRESET, PHYSICS_PRESETS } from '$lib/motion/physics/model';
import { applyPhysicsPreset, setPhysics } from '$lib/motion/physics/ops';
import { STYLES, styleOf } from '$lib/motion/style';
import { MOTION_STYLES } from '$lib/motion/style-model';
import { unitOf, propsOwner, shownKeyframes, shownMask, shownOffset, shownRecord, storedMask, storedOffset, storedRecord, toShown, toStored, type Owner } from '$lib/motion/units';

export type MotionSession = { doc: MotionDoc; baseVersion: number; edits: string[]; selection: string[]; frames: Map<string, Frame[]>; views: number; checkedAt: number; codeWrites: number; effectFailures?: number; gate?: QualityProblem[] };

export type CheckResult = { ok: boolean; problems: string[]; frames: Frame[] };

export const MAX_CODE_WRITES_PER_TURN = 12;
export const MAX_COMP_CALLS = 40;

export type Voiceover = { ok: true; assetId: string; seconds: number; url: string | null } | { ok: false; error: string };

export type Music = { ok: true; assetId: string; seconds: number; url: string | null; source: string; track: string } | { ok: false; error: string };

export type SoundStored = { ok: true; assetId: string; seconds: number; url: string | null } | { ok: false; error: string };

export type MotionToolDeps = {
  session: MotionSession;
  assets: MotionAsset[];
  newId: () => string;
  voiceover: (input: { text: string; voiceId?: string }) => Promise<Voiceover>;
  music?: (input: { mood: Mood; bpm?: number; seconds: number }) => Promise<Music>;
  sound?: (score: SoundScore, seconds: number) => Promise<SoundStored>;
  frames: (callId: string, times: number[]) => Promise<Frame[] | null>;
  inspect?: (frames: Frame[]) => Promise<FrameStat[]>;
  check: (callId: string, doc: MotionDoc, name: string) => Promise<CheckResult | null>;
  analysis?: (assetId: string) => Promise<AudioAnalysis | null>;
  batch?: (input: { doc: MotionDoc; rows: { name: string; values: Record<string, string> }[] }) => Promise<Record<string, unknown>>;
  renderLink?: () => Promise<Record<string, unknown>>;
  embed?: (action: EmbedAction) => Promise<Record<string, unknown>>;
  templates?: TemplateLibrary;
  revisions?: RevisionLibrary;
  site?: (url: string) => Promise<SourceRead>;
  brand?: (name?: string) => Promise<SourceRead>;
  importAsset?: (url: string, label?: string) => Promise<AssetImport>;
  capture?: (url: string, view: CaptureView) => Promise<SiteCapture>;
  readUi?: (asset: MotionAsset, region?: UiRegion) => Promise<UiRead>;
  effects?: EffectStore;
  layouts?: LayoutStore;
  web?: WebToolDeps;
  storyboard?: StoryboardPort;
};

export type StoryboardPort = {
  write: (board: Storyboard, media: Record<string, MediaKind>) => Promise<{ canvasId: string; nodes: number; connections: number }>;
  read: () => Promise<({ canvasId: string } & StoryboardRead) | null>;
  edit: (nodeId: string, text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  link: (nodeId: string, clipIds: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export type RevisionEntry = { version: number; summary: string | null; actorKind: string; createdAt: string; clips: number };

export type RevisionLibrary = { list: () => Promise<RevisionEntry[]>; read: (version: number) => Promise<MotionDoc | null> };

export type UiRegion = { x: number; y: number; width: number; height: number };

export type UiRead = { ok: true; structure: UiStructure } | { ok: false; error: string };

export enum CaptureView {
  Desktop = 'desktop',
  Mobile = 'mobile'
}

export type CaptureShot = { part: string; asset: MotionAsset; width: number; height: number };

export type SiteCapture = { ok: true; shots: CaptureShot[] } | { ok: false; error: string };

export type SourceRead = { ok: true } & Record<string, unknown> | { ok: false; error: string };

export type AssetImport = { ok: true; asset: MotionAsset; width: number | null; height: number | null } | { ok: false; error: string };

export enum EmbedAction {
  Publish = 'publish',
  Unpublish = 'unpublish'
}

const UNREADABLE = (what: string) => ({ ok: false as const, error: `${what} is not available in this workspace` });

const fieldSpec = (f: ExposedField) => ({ key: f.key, label: f.label, type: f.type, min: f.min, max: f.max, unit: f.unit, options: f.options, aspect: f.aspect });

const framesAt = (s: number, fps: number) => Math.round(s * fps);
const secondsAt = (f: number, fps: number) => Math.round((f / fps) * 100) / 100;

export function docSummary(doc: MotionDoc, selection: string[]) {
  const secs = (f: number) => secondsAt(f, doc.fps);
  const edgeSummary = (edge: { kind: string; durationInFrames: number }) => ({ kind: edge.kind, duration: secs(edge.durationInFrames) });
  const inSeconds = (keyframes: Record<string, Keyframe[] | undefined>) =>
    Object.fromEntries(Object.entries(keyframes).map(([prop, track]) => [prop, (track ?? []).map(({ frame, ...rest }) => ({ time: secs(frame), ...rest }))]));
  const cameraSummary = (camera: Camera | null) =>
    camera ? { values: shownRecord(CAMERA_LANE, camera.base, doc), dof: camera.dof, keyframes: inSeconds(shownKeyframes(CAMERA_LANE, camera.keyframes, doc)), expressions: camera.expressions } : null;
  const lookSummary = (look: Look | null) => (look ? { ...look, lights: look.lights.map((l) => ({ ...l, keyframes: inSeconds(l.keyframes) })) } : null);

  return {
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    background: doc.background,
    motionBlur: doc.motionBlur,
    duration: secs(doc.durationInFrames),
    selected: selection,
    tracks: doc.tracks.map((t) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      hidden: t.hidden ?? false,
      locked: t.locked ?? false,
      clips: t.clips.map((c) => ({
        id: c.id,
        component: c.component,
        start: secs(c.from),
        duration: secs(c.durationInFrames),
        trimStart: secs(c.trimStart),
        props: shownRecord(propsOwner(c.component), c.props, doc),
        in: edgeSummary(c.transitionIn),
        out: edgeSummary(c.transitionOut),
        junction: c.junction ? { kind: c.junction.kind, duration: secs(c.junction.durationInFrames), from: junctionPairs(doc).find((p) => p.incoming === c.id)?.outgoing ?? null } : null,
        transform: shownRecord(c.component, c.transform, doc),
        mask: c.mask && shownMask(c.component, c.mask, doc),
        maskStack: c.maskStack.map((m) => shownMask(c.component, m, doc)),
        matte: c.matte,
        keyframes: inSeconds(shownKeyframes(c.component, c.keyframes, doc)),
        depth: c.depth,
        space: c.space,
        parent: c.parent,
        parentOpacity: c.parentOpacity,
        expressions: c.expressions,
        effects: c.effects,
        shaders: c.shaders,
        blend: c.blend,
        animators: c.animators,
        textPath: c.textPath,
        motionBlur: c.motionBlur,
        hidden: c.hidden ?? false,
        locked: c.locked ?? false,
        markers: (c.markers ?? []).map((m) => ({ label: m.label, time: secs(m.frame) })),
        physics: c.physics ? shownRecord(c.component, c.physics, doc) : null,
        path: c.path ? { autoOrient: c.path.autoOrient, tangents: c.path.tangents.map((t) => ({ time: secs(t.frame), in: shownOffset(c.component, t.in, doc), out: shownOffset(c.component, t.out, doc) })), problem: pathProblem(c) } : null
      }))
    })),
    assets: doc.assets,
    fields: doc.fields,
    fonts: doc.fonts,
    markers: (doc.markers ?? []).map((m) => ({ label: m.label, time: secs(m.frame) })),
    workArea: doc.workArea ? { start: secs(doc.workArea.from), end: secs(doc.workArea.to) } : null,
    interactive: interactiveOf(doc),
    style: styleOf(doc),
    script: doc.script ?? null,
    sound: doc.sound ?? null,
    camera: cameraSummary(doc.camera),
    look: lookSummary(doc.look),
    components: Object.entries(doc.components).map(([name, c]) => customSummary(name, c)),
    shaders: Object.fromEntries(Object.entries(doc.shaders).map(([ref, d]) => [ref, { name: d.name, version: d.version, params: d.params }])),
    comps: Object.entries(doc.comps).map(([id, c]) => ({ id, name: c.name, ...(c.template ? { template: c.template.id } : {}), duration: secs(c.durationInFrames), clips: c.tracks.flatMap((t) => t.clips.map((clip) => clip.id)) }))
  };
}

const transformInput = z.object(Object.fromEntries(TRANSFORM_KEYS.map((k) => [k, z.number().optional()]))).partial();

const keyShape = { in: z.enum(INTERPS).optional(), out: z.enum(INTERPS).optional(), roving: z.boolean().optional() };

const maskInput = z
  .object({
    kind: z.enum(MASK_KIND_IDS),
    mode: z.enum(MASK_MODES).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    rotation: z.number().optional(),
    feather: z.number().optional(),
    expansion: z.number().optional(),
    opacity: z.number().optional(),
    invert: z.boolean().optional(),
    points: z.array(z.tuple([z.number(), z.number()])).optional(),
    assetId: z.string().optional(),
    text: z.string().optional()
  })
  .strict();

const SPRING_HELP = '(soft by default; stiffness and damping override it: keep damping near 2·√stiffness for the house soft settle, never a visible bounce).';

const INTERP_HELP = `in/out set how the value enters and leaves a keyframe: bezier (default, uses ease), linear, hold (no change until the next keyframe), auto (smooth, never overshoots), continuous (smooth, keeps speed through). roving true (${SPATIAL_KEYS.join(', ')} only) retimes a middle keyframe so the speed is even.`;

type KeyInput = { time: number; value: Keyframe['value']; ease: Keyframe['ease']; in?: Keyframe['in']; out?: Keyframe['out']; roving?: boolean };

const MODIFIER_CATALOGUE = MODIFIER_KINDS.map((k) => `${k} (${MODIFIERS[k].params.map((p) => `${p.key} ${p.options ? p.options.map((o, i) => `${i}=${o}`).join('/') : `${p.min}..${p.max}`}`).join(', ')})`).join('; ');
const PATH_GUIDE = 'SVG path data (M L H V C S Q T Z, absolute or relative) in the shape box: 0,0 is its top-left and 1,1 its bottom-right';
const EFFECT_CATALOGUE = EFFECT_KINDS.map((k) => `${k} (${EFFECTS[k].about}; ${EFFECTS[k].params.map((p) => `${p.key} ${p.kind === ValueKind.Color ? 'colour' : `${p.min}..${p.max}`}`).join(', ')})`).join('; ');

const effectSpec = z.object({ kind: z.enum(EFFECT_KINDS), params: z.record(z.string(), z.union([z.number(), z.string()])).optional() });

type EffectSpec = z.infer<typeof effectSpec>;

const PLACED = { track_id: z.string().optional() };

const PLACED_PICTURE = { ...PLACED, effects: z.array(effectSpec).max(MAX_EFFECTS).optional() };

const PLACEMENT_HELP = 'track_id puts it on that track (else the first that fits); effects is its effect stack, same kinds and params as add_effect.';

const MAX_FONT_RESULTS = 50;
const DEFAULT_FONT_RESULTS = 12;

const ANIMATOR_VALUES = `${VALUE_KEYS.map((k) => `${k} ${VALUES[k].min}..${VALUES[k].max}`).join(', ')}, color`;

const animatorValues = z.object({ ...Object.fromEntries(VALUE_KEYS.map((k) => [k, z.number().optional()])), color: z.string().optional() }).partial();

const animatorFields = {
  shape: z.enum(SELECTOR_SHAPES).optional(),
  seed: z.number().int().nullable().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  offset: z.number().optional(),
  softness: z.number().optional(),
  values: animatorValues.optional()
};

const CAMERA_UNITS = `${CAMERA_KEYS.map((k) => `${k} ${CAMERA[k].min}..${CAMERA[k].max}`).join(', ')}. x/y are in px of the frame (the ranges above are in frame widths/heights), z is the dolly in pixels (positive moves forward), rotations and fov in degrees, focusDistance is the depth in focus (same units as clip depth), aperture the blur strength (px of blur per 100 px out of focus)`;

function customSummary(name: string, c: CustomComponent) {
  return {
    name,
    version: c.version,
    check: checkState(c),
    props: Object.fromEntries(Object.entries(c.propsSchema.properties).map(([key, spec]) => [key, spec.enum?.join('|') ?? spec.format ?? spec.type]))
  };
}

function componentCatalogue(doc: MotionDoc) {
  return {
    library: libraryCatalogue(doc),
    custom: Object.entries(doc.components).map(([name, c]) => customSummary(name, c)),
    note: 'A custom component is used with add_clip component "Custom" and props { name, ...its props }.'
  };
}

function libraryCatalogue(doc: MotionDoc) {
  const range = (id: ComponentId, key: string, min: number, max: number) => `${toShown(propsOwner(id), key, min, doc)}..${toShown(propsOwner(id), key, max, doc)}`;
  return COMPONENT_IDS.map((id) => ({
    id,
    track: COMPONENTS[id].track,
    about: COMPONENTS[id].description,
    animates: ANIMATABLE[id].map((p) => p.key),
    props: Object.fromEntries(fieldsOf(id).map((f) => [f.key, f.options ? f.options.join('|') : f.min !== undefined ? range(id, f.key, f.min, f.max ?? f.min) : f.control]))
  }));
}

function shownProblem(doc: MotionDoc, component: ComponentId, props: Record<string, unknown> = {}): string | null {
  const owner = propsOwner(component);
  const out = fieldsOf(component).flatMap((f) => {
    const value = props[f.key];
    if (typeof value !== 'number' || f.min === undefined || f.max === undefined || !unitOf(owner, f.key)) {
      return [];
    }
    const [min, max] = [toShown(owner, f.key, f.min, doc), toShown(owner, f.key, f.max, doc)];
    return value < min || value > max ? [`${f.key} ${value} is outside ${min}..${max} ${unitOf(owner, f.key)}`] : [];
  });
  return out.length ? `${component}: ${out.join('; ')}` : null;
}

const TIMING_KEYS = new Set(['start', 'from', 'duration', 'durationInFrames', 'end', 'length']);

function explained(doc: MotionDoc, error: string): string {
  const missing = /^no clip (.+)$/.exec(error);
  if (missing) {
    const ids = doc.tracks.flatMap((t) => t.clips.map((c) => `${c.id} (${c.component})`));
    return `no clip "${missing[1]}". Clips that exist: ${ids.join(', ') || 'none'}.`;
  }
  return error;
}

function propsError(doc: MotionDoc, clipId: string, patch: Record<string, unknown>, error: string): string {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return explained(doc, error);
  }
  const allowed = fieldsOf(clip.component).map((f) => f.key);
  const timing = Object.keys(patch).filter((k) => TIMING_KEYS.has(k));
  const hint = timing.length ? ` ${timing.join(', ')} is timing, not a prop: use set_timing (start/duration in seconds).` : '';
  return `${error}. ${clip.component} props are: ${allowed.join(', ')}.${hint}`;
}

export function createMotionTools(deps: MotionToolDeps): Record<string, Tool> {
  const layoutWritten = (written: LayoutWritten | null) => {
    if (!written) {
      return { ok: false, error: 'custom layouts are not available here' };
    }
    if (written.outcome !== Outcome.Ok) {
      return { ok: false, error: `${written.outcome}${written.problems?.length ? `: ${written.problems.join('; ')}` : ''}` };
    }
    return { ok: true, layout_id: written.layout.id, name: written.layout.name, version: written.layout.version };
  };

  const effectWrite = async (write: (store: EffectStore) => Promise<Written>) => {
    if (!deps.effects) {
      return { ok: false, error: 'custom effects are not available here' };
    }
    if ((deps.session.effectFailures ?? 0) >= MAX_EFFECT_FAILURES) {
      return { ok: false, error: 'three effect writes failed this turn: tell the user what the check said instead of trying again' };
    }

    const written = await write(deps.effects);
    if (written.outcome !== Outcome.Ok) {
      deps.session.effectFailures = (deps.session.effectFailures ?? 0) + 1;
      return { ok: false, error: `${written.outcome}${written.problems?.length ? `: ${written.problems.join('; ')}` : ''}` };
    }

    const { effect } = written;
    const passed = effect.check.state !== EffectCheck.Failed;
    if (!passed) {
      deps.session.effectFailures = (deps.session.effectFailures ?? 0) + 1;
    }
    return { ok: passed, ...(passed ? {} : { error: effect.check.problems.join('; ') }), effect_id: effect.id, name: effect.name, version: effect.version, check: effect.check };
  };

  const { session } = deps;
  const frames = (s: number) => framesAt(s, session.doc.fps);
  const asKey = (k: KeyInput): Keyframe => shaped({ frame: frames(k.time), value: k.value, ease: k.ease }, { in: k.in, out: k.out, roving: k.roving });
  const ownerOf = (clipId: string): Owner => findClip(session.doc, clipId)?.clip.component ?? null;
  const propsOf = (clipId: string): Owner => {
    const owner = ownerOf(clipId);
    return owner && owner !== CAMERA_LANE ? propsOwner(owner) : null;
  };
  const propsIn = (component: ComponentId, props: Record<string, unknown> = {}) => storedRecord(propsOwner(component), props, session.doc);
  const keyIn =
    (owner: Owner, prop: string) =>
    (k: KeyInput): Keyframe =>
      asKey(typeof k.value === 'number' ? { ...k, value: toStored(owner, prop, k.value, session.doc) } : k);

  const logoUrls = new Set<string>();
  const brandLogos = new Set<string>();
  const sitePages: SitePage[] = [];
  const readPages = (read: SourceRead) => {
    const pages = (read as { site?: { pages?: SitePage[] } }).site?.pages ?? [];
    sitePages.push(...pages);
    return read;
  };

  const SOURCING: Record<BrandKind, (script: LaunchScript) => { unread: boolean; problems: string[] }> = {
    [BrandKind.Real]: (script) => ({
      unread: !sitePages.length,
      problems: sourcesOf(script)
        .filter((s) => !quoted(sitePages, s))
        .map((s) => `"${s.quote}" is not on ${s.url}: quote the page word for word or drop the claim`)
    }),
    [BrandKind.Fictional]: () => ({ unread: false, problems: [] })
  };

  const readLogos = (read: SourceRead) => {
    const found = read as { site?: { logos?: { url?: string }[] }; brand?: { logoUrl?: string | null } };
    for (const url of [...(found.site?.logos ?? []).map((l) => l.url), found.brand?.logoUrl]) {
      if (url) {
        logoUrls.add(url);
      }
    }
    return read;
  };

  const assetPixels = (): Pixels => Object.fromEntries(deps.assets.flatMap((a) => (a.width && a.height ? [[a.id, { width: a.width, height: a.height }]] : [])));

  const newlySoft = (doc: MotionDoc) => {
    const pixels = assetPixels();
    const already = new Set(softPictures(session.doc, pixels).map((p) => p.detail));
    return softPictures(doc, pixels).filter((p) => !already.has(p.detail));
  };

  const apply = (result: OpResult, what: string) => {
    if (!result.ok) {
      return { ok: false, error: explained(session.doc, result.error) };
    }
    const blownUp = newlySoft(result.doc);
    if (blownUp.length) {
      return { ok: false, error: blownUp.map((p) => p.detail).join('; ') };
    }
    session.doc = result.doc;
    session.edits.push(what);
    return { ok: true, edit: what };
  };

  const shortened = (result: OpResult): OpResult => {
    if (!result.ok || contentEnd(result.doc) >= contentEnd(session.doc)) {
      return result;
    }
    const fitted = fitDuration(result.doc);
    return fitted.ok ? fitted : result;
  };

  async function codeWrite(result: OpResult, name: string, what: string, callId: string) {
    if (session.codeWrites >= MAX_CODE_WRITES_PER_TURN) {
      return { ok: false, error: `code budget for this turn is spent (${MAX_CODE_WRITES_PER_TURN} writes): finish with what you have` };
    }
    session.codeWrites += 1;
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    session.doc = result.doc;
    session.edits.push(what);
    const version = result.doc.components[name].version;

    const check = await deps.check(callId, result.doc, name);
    if (!check) {
      return { ok: true, version, check: CheckState.Unchecked, note: 'no editor preview answered: the editor checks it when opened, and export waits for it' };
    }
    const state = check.ok ? CheckState.Passed : CheckState.Failed;
    const recorded = recordCheck(session.doc, name, { hash: sourceHash(result.doc.components[name]), state, problems: check.problems });
    session.doc = recorded.ok ? recorded.doc : session.doc;
    if (check.ok) {
      return { ok: true, version, check: state };
    }
    session.frames.set(callId, check.frames);
    const shown = check.frames.length ? ' The two frames that should be identical follow as images.' : '';
    return { ok: false, error: `${name} v${version} is saved but failed the seek-determinism check, so it cannot be exported:\n- ${check.problems.join('\n- ')}\nFix it with patch_component: build every change on tl from props and time only.${shown}` };
  }

  const analysisOf = (assetId: string) => (deps.analysis ? deps.analysis(assetId) : Promise.resolve(null));

  async function docBeats(hit: Hit) {
    const ids = [...new Set(clipsOf(session.doc).flatMap((c) => (c.component === 'Audio' && typeof c.props.assetId === 'string' ? [c.props.assetId] : [])))];
    const found = await Promise.all(ids.map(async (id) => [id, await analysisOf(id)] as const));
    const analyses = Object.fromEntries(found.flatMap(([id, a]) => (a ? [[id, a]] : [])));
    return hitFrames(session.doc, analyses, hit);
  }

  async function speechOf(clipId: string) {
    const assetId = findClip(session.doc, clipId)?.clip.props.assetId;
    return typeof assetId === 'string' ? ((await analysisOf(assetId))?.speech ?? null) : null;
  }

  const assetKnown = (id: unknown) => typeof id !== 'string' || deps.assets.some((a) => a.id === id);

  const registered = (result: OpResult, assetId: unknown): OpResult => {
    const asset = deps.assets.find((a) => a.id === assetId);
    if (!result.ok || !asset || result.doc.assets.some((a) => a.id === asset.id)) {
      return result;
    }
    return { ok: true, doc: { ...result.doc, assets: [...result.doc.assets, { id: asset.id, kind: asset.kind, name: asset.label }] } };
  };

  const withEffects = (result: OpResult, clipIds: string[], effects: EffectSpec[] = []): OpResult =>
    clipIds.flatMap((id) => effects.map((e) => ({ id, e }))).reduce<OpResult>((r, { id, e }) => (r.ok ? addEffect(r.doc, id, e.kind, deps.newId(), e.params) : r), result);

  const created = (out: ReturnType<typeof apply>, clipId: string) => (out.ok ? { ...out, clip_id: clipId } : out);

  const tools: Record<string, Tool> = {
    get_motion_doc: tool({
      description: 'Read the video being edited: size, duration in seconds, tracks and clips (start/duration in seconds), and the clips the user has selected.',
      inputSchema: z.object({}).strict(),
      execute: async () => docSummary(session.doc, session.selection)
    }),

    list_components: tool({
      description: 'Every component a clip can use: the library (its track and props, ranges in the units of the prompt for this video size) and the custom components written in code for this video.',
      inputSchema: z.object({}).strict(),
      execute: async () => componentCatalogue(session.doc)
    }),

    list_assets: tool({
      description: 'Images, videos, audio and 3D models of this project that clips can use, by id.',
      inputSchema: z.object({}).strict(),
      execute: async () => deps.assets.map((a) => ({ id: a.id, kind: a.kind, label: a.label }))
    }),

    add_clip: tool({
      description: `Add a clip of a library component at a time in seconds. Props not given take the component defaults. Colours may be brand.primary/secondary/accent/background/text or #rrggbb. ${PLACEMENT_HELP} Returns the clip id.`,
      inputSchema: z.object({
        component: z.enum(COMPONENT_IDS),
        start: z.number().min(0),
        duration: z.number().positive().optional(),
        props: z.record(z.string(), z.unknown()).optional(),
        ...PLACED_PICTURE
      }),
      execute: async (input) => {
        if (!assetKnown(input.props?.assetId)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        const outside = shownProblem(session.doc, input.component, input.props);
        if (outside) {
          return { ok: false, error: outside };
        }
        const id = deps.newId();
        const result = addClip(
          session.doc,
          { component: input.component, from: frames(input.start), durationInFrames: input.duration ? frames(input.duration) : undefined, trackId: input.track_id, props: propsIn(input.component, input.props) },
          id
        );
        return created(apply(withEffects(registered(result, input.props?.assetId), [id], input.effects), `added ${input.component}`), id);
      }
    }),

    set_timing: tool({
      description: 'Change when a clip starts and how long it lasts, in seconds.',
      inputSchema: z.object({ clip_id: z.string(), start: z.number().min(0).optional(), duration: z.number().positive().optional() }),
      execute: async (input) =>
        apply(shortened(setTiming(session.doc, input.clip_id, { from: input.start === undefined ? undefined : frames(input.start), durationInFrames: input.duration === undefined ? undefined : frames(input.duration) })), `retimed ${input.clip_id}`)
    }),

    set_props: tool({
      description: 'Change some props of a clip; the rest are kept. Validated against the component.',
      inputSchema: z.object({ clip_id: z.string(), props: z.record(z.string(), z.unknown()) }),
      execute: async (input) => {
        if (!assetKnown(input.props.assetId)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        const component = findClip(session.doc, input.clip_id)?.clip.component;
        const outside = component ? shownProblem(session.doc, component, input.props) : null;
        if (outside) {
          return { ok: false, error: outside };
        }
        const result = setProps(session.doc, input.clip_id, storedRecord(propsOf(input.clip_id), input.props, session.doc));
        if (!result.ok) {
          return { ok: false, error: propsError(session.doc, input.clip_id, input.props, result.error) };
        }
        return apply(registered(result, input.props.assetId), `edited ${input.clip_id}`);
      }
    }),

    set_transition: tool({
      description: 'Set the transition at the start (in) or end (out) of a clip.',
      inputSchema: z.object({ clip_id: z.string(), side: z.enum([Side.In, Side.Out]), kind: z.enum(TRANSITION_KINDS), duration: z.number().min(0).max(2) }),
      execute: async (input) => apply(setTransition(session.doc, input.clip_id, input.side, { kind: input.kind, durationInFrames: frames(input.duration) }), `transition on ${input.clip_id}`)
    }),

    set_clip_transition: tool({
      description: `Transition between two clips at a cut, like a dissolve in an editor: put it on the clip that arrives (clip_id); the clip that ends exactly where it starts (same track first, else any video track) is the one that leaves. Kinds: ${JUNCTION_KINDS.map((k) => `${k} (${JUNCTION[k].label})`).join(', ')}; none removes it. duration in seconds, centred on the cut: both clips stay on screen half of it longer. It replaces the out transition of the leaving clip and the in transition of the arriving one.`,
      inputSchema: z.object({ clip_id: z.string(), kind: z.enum([...JUNCTION_KINDS, 'none']), duration: z.number().min(0.05).max(2).default(0.5) }),
      execute: async (input) => apply(setJunction(session.doc, input.clip_id, input.kind === 'none' ? null : { kind: input.kind, durationInFrames: frames(input.duration) }), `transition into ${input.clip_id}`)
    }),

    trim_clip: tool({
      description: 'Move the start or the end edge of a clip to a time in seconds, keeping the other edge.',
      inputSchema: z.object({ clip_id: z.string(), edge: z.enum([ClipEdge.Start, ClipEdge.End]), at: z.number().min(0) }),
      execute: async (input) => apply(shortened(trimClip(session.doc, input.clip_id, input.edge, frames(input.at))), `trimmed ${input.clip_id}`)
    }),

    move_clip: tool({
      description: 'Move a clip to a new start time (seconds) or to a marker by its label, and optionally to another track of the same kind.',
      inputSchema: z.object({ clip_id: z.string(), start: z.number().min(0).optional(), marker: z.string().optional(), track_id: z.string().optional() }),
      execute: async (input) => {
        const from = input.marker === undefined ? frames(input.start ?? 0) : markerFrame(session.doc, input.marker);
        if (from === null) {
          return { ok: false, error: `no marker called ${input.marker}: markers are ${allMarkers(session.doc).map((m) => m.label).join(', ') || 'none'}` };
        }
        return apply(moveClip(session.doc, input.clip_id, { from, trackId: input.track_id }), `moved ${input.clip_id}`);
      }
    }),

    set_marker: tool({
      description: 'Add a labelled marker at time (seconds): on the video, or on a clip (time from the clip start) with clip_id. Markers are snap points and can be targeted by label (move_clip marker).',
      inputSchema: z.object({ label: z.string().min(1).max(40), time: z.number().min(0), clip_id: z.string().optional() }),
      execute: async (input) => apply(addMarker(session.doc, { frame: frames(input.time), label: input.label, clipId: input.clip_id }), `marker ${input.label}`)
    }),

    remove_marker: tool({
      description: 'Remove a marker by its label, from the video or from a clip (clip_id).',
      inputSchema: z.object({ label: z.string(), clip_id: z.string().optional() }),
      execute: async (input) => apply(removeMarker(session.doc, input.label, input.clip_id), `removed marker ${input.label}`)
    }),

    set_work_area: tool({
      description: 'Set the work area (seconds) the editor previews and loops, or clear it with clear true.',
      inputSchema: z.object({ start: z.number().min(0).optional(), end: z.number().min(0).optional(), clear: z.boolean().optional() }),
      execute: async (input) => apply(setWorkArea(session.doc, input.clear ? null : { from: frames(input.start ?? 0), to: input.end === undefined ? session.doc.durationInFrames : frames(input.end) }), 'set the work area')
    }),

    set_visibility: tool({
      description: 'Hide (left out of the render) or lock (not moved by edits) a track (track_id) or a clip (clip_id).',
      inputSchema: z.object({ track_id: z.string().optional(), clip_id: z.string().optional(), hidden: z.boolean().optional(), locked: z.boolean().optional() }),
      execute: async (input) => {
        const flags = { ...(input.hidden === undefined ? {} : { hidden: input.hidden }), ...(input.locked === undefined ? {} : { locked: input.locked }) };
        const result = input.clip_id ? setClipFlags(session.doc, input.clip_id, flags) : input.track_id ? setTrackFlags(session.doc, input.track_id, flags) : { ok: false as const, error: 'give a track_id or a clip_id' };
        return apply(result, 'changed visibility');
      }
    }),

    arrange_clips: tool({
      description: `Arrange clips in time, in their start order: nudge (move all by seconds, negative earlier), sequence (end to end, seconds = gap), stagger (each start seconds after the previous), align_start, align_end, distribute (even starts between first and last). Locked clips are refused.`,
      inputSchema: z.object({ clip_ids: z.array(z.string()).min(1), op: z.enum(ARRANGE_OPS), seconds: z.number().optional() }),
      execute: async (input) => apply(ARRANGE[input.op](session.doc, input.clip_ids, frames(Math.abs(input.seconds ?? 0)) * Math.sign(input.seconds ?? 0)), `${input.op} ${input.clip_ids.length} clips`)
    }),

    remove_clip: tool({
      description: 'Remove one or more clips. When the content then ends earlier, the video is fitted to it (fit_duration).',
      inputSchema: z.object({ clip_ids: z.array(z.string()).min(1) }),
      execute: async (input) => apply(shortened(removeClips(session.doc, input.clip_ids)), `removed ${input.clip_ids.length} clip(s)`)
    }),

    fit_duration: tool({
      description: 'Fit the video length to its content: it ends where the last content ends plus the style hold (the last frame stays on screen), and backgrounds and music past that end are trimmed. Use it whenever the gate names an empty tail.',
      inputSchema: z.object({}),
      execute: async () => apply(fitDuration(session.doc), 'fitted the duration to the content')
    }),

    set_transform: tool({
      description: `Set base transform values of a clip; the rest are kept. Keys: ${TRANSFORM_KEYS.join(', ')}. x/y are offsets in px of the frame, scale/scaleX/scaleY and opacity in % (100 = as is), rotations and skews in degrees, z and perspective in px, anchorX/anchorY the pivot inside the clip box (0..1), blur in px.`,
      inputSchema: z.object({ clip_id: z.string(), transform: transformInput }),
      execute: async (input) => apply(setTransform(session.doc, input.clip_id, storedRecord(ownerOf(input.clip_id), input.transform, session.doc)), `transformed ${input.clip_id}`)
    }),

    set_keyframes: tool({
      description:
        `Animate one prop of a clip: replaces its keyframes. time is seconds from the clip start; ease is the curve leaving that keyframe: standard (default, feega.inOut: expo in-out with a soft settle, for moves), enter (feega.out, for entrances), exit (feega.in, for exits), linear (only a drift or a loop), overshoot (a visible bounce: off-style), or a cubic-bezier [x1,y1,x2,y2]. ${INTERP_HELP} Colour props take #rrggbb or brand colours. list_components says what each component animates.`,
      inputSchema: z.object({
        clip_id: z.string(),
        prop: z.string(),
        keyframes: z.array(z.object({ time: z.number().min(0), value: z.union([z.number(), z.string()]), ease: easeSchema.default(Ease.Standard), ...keyShape })).min(1)
      }),
      execute: async (input) => apply(setKeyframes(session.doc, input.clip_id, input.prop, input.keyframes.map(keyIn(ownerOf(input.clip_id), input.prop))), `animated ${input.prop} of ${input.clip_id}`)
    }),

    set_key_interpolation: tool({
      description: `Change the interpolation of keyframes a clip already has on one prop, all of them or only those at the given times (seconds from the clip start). ${INTERP_HELP}`,
      inputSchema: z.object({ clip_id: z.string(), prop: z.string(), times: z.array(z.number().min(0)).optional(), ...keyShape }),
      execute: async (input) => {
        const track = findClip(session.doc, input.clip_id)?.clip.keyframes[input.prop] ?? [];
        const picked = input.times ? input.times.map(frames) : track.map((k) => k.frame);
        const refs = picked.map((frame) => ({ clipId: input.clip_id, prop: input.prop, frame }));
        return apply(setKeyInterp(session.doc, refs, { in: input.in, out: input.out, roving: input.roving }), `interpolation of ${input.prop} on ${input.clip_id}`);
      }
    }),

    apply_ease_preset: tool({
      description: `Apply an ease preset to keyframes of one prop (all, or those at the given times in seconds from the clip start). ${EASE_PRESET_IDS.map((p) => `${p}: ${EASE_PRESETS[p].label}`).join('; ')}. Easy ease presets work around the keyframe (the segment before and after it), Apple presets replace the segment leaving it.`,
      inputSchema: z.object({ clip_id: z.string(), prop: z.string(), times: z.array(z.number().min(0)).optional(), preset: z.enum(EASE_PRESET_IDS) }),
      execute: async (input) => {
        const track = findClip(session.doc, input.clip_id)?.clip.keyframes[input.prop] ?? [];
        const picked = input.times ? input.times.map(frames) : track.map((k) => k.frame);
        const refs = picked.map((frame) => ({ clipId: input.clip_id, prop: input.prop, frame }));
        return apply(applyEasePreset(session.doc, refs, input.preset), `${input.preset} on ${input.prop}`);
      }
    }),

    set_ease_handles: tool({
      description:
        'Shape the segment leaving the keyframe at time (seconds from the clip start), like dragging the bezier handles in a graph editor: influence 0..100 (% of the segment the handle reaches), speed in the units of the prop per second (px/s for x/y, %/s for scale; 0 = eased to a stop). Values not given are kept.',
      inputSchema: z.object({
        clip_id: z.string(),
        prop: z.string(),
        time: z.number().min(0),
        out_influence: z.number().min(0).max(100).optional(),
        out_speed: z.number().optional(),
        in_influence: z.number().min(0).max(100).optional(),
        in_speed: z.number().optional()
      }),
      execute: async (input) => {
        const track = findClip(session.doc, input.clip_id)?.clip.keyframes[input.prop] ?? [];
        const at = track.findIndex((k) => k.frame === frames(input.time));
        if (at < 0 || at === track.length - 1) {
          return { ok: false, error: `no segment leaves a ${input.prop} keyframe at ${input.time}s: keyframes are at ${track.map((k) => secondsAt(k.frame, session.doc.fps)).join(', ')}s` };
        }
        const [a, b] = [track[at], track[at + 1]];
        const h = easeHandles(a, b, session.doc.fps);
        const percent = (n: number | undefined, fallback: number) => (n === undefined ? fallback : n / 100);
        const speed = (n: number | undefined, fallback: number) => (n === undefined ? fallback : toStored(ownerOf(input.clip_id), input.prop, n, session.doc));
        const ease = withHandles(
          { outInfluence: percent(input.out_influence, h.outInfluence), outSpeed: speed(input.out_speed, h.outSpeed), inInfluence: percent(input.in_influence, h.inInfluence), inSpeed: speed(input.in_speed, h.inSpeed) },
          a,
          b,
          session.doc.fps
        );
        const ref = { clipId: input.clip_id, prop: input.prop, frame: a.frame };
        const eased = setKeyEase(session.doc, ref, ease);
        const out = eased.ok ? setKeyInterp(eased.doc, [ref], { out: Interp.Bezier }) : eased;
        const both = out.ok ? setKeyInterp(out.doc, [{ ...ref, frame: b.frame }], { in: Interp.Bezier }) : out;
        return apply(both, `shaped the ease of ${input.prop}`);
      }
    }),

    set_motion_path: tool({
      description:
        'Turn the x/y position keyframes of a clip into one curved motion path (enabled true) or back to separate x and y animations (false). x and y must be keyed at the same times. The path is smooth through the keys; bend it with set_path_tangent. The x keyframes time the travel along the path (their ease, in/out and roving). auto_orient turns the clip along the direction of travel (added to rotateZ).',
      inputSchema: z.object({ clip_id: z.string(), enabled: z.boolean().optional(), auto_orient: z.boolean().optional() }),
      execute: async (input) => apply(setMotionPath(session.doc, input.clip_id, { enabled: input.enabled, autoOrient: input.auto_orient }), `motion path on ${input.clip_id}`)
    }),

    set_path_tangent: tool({
      description:
        'Bend the motion path at the position keyframe at time (seconds from the clip start): in and out are the bezier handles as [dx, dy] offsets from the key point, in px of the frame (like x/y). Omitted handles are flat ([0,0]).',
      inputSchema: z.object({ clip_id: z.string(), time: z.number().min(0), in: z.tuple([z.number(), z.number()]).optional(), out: z.tuple([z.number(), z.number()]).optional() }),
      execute: async (input) => {
        const owner = ownerOf(input.clip_id);
        const offset = (o: [number, number] = [0, 0]) => storedOffset(owner, o, session.doc);
        return apply(setPathTangent(session.doc, input.clip_id, { frame: frames(input.time), in: offset(input.in), out: offset(input.out) }), `bent the path of ${input.clip_id}`);
      }
    }),

    analyze_audio: tool({
      description:
        'Analyse an audio or video asset (from list_assets): tempo in BPM, beat grid and onsets (seconds in the file), speech regions (seconds in the file). Map file seconds to the timeline through the clip: timeline = clip start + (file time - clip trimStart). Expressions read it per frame with audio.amp/beat/onset.',
      inputSchema: z.object({ asset_id: z.string() }),
      execute: async (input) => {
        const analysis = await analysisOf(input.asset_id);
        if (!analysis) {
          return { ok: false, error: `no analysis for ${input.asset_id}: it must be an audio or video asset with a file` };
        }
        const { duration, bpm, beats, onsets, speech } = analysis;
        return { ok: true, duration, bpm, beats, onsets, speech };
      }
    }),

    pulse_with_music: tool({
      description: `Make a clip pulse with the music: sets an audio-reactive expression on ${PULSE_PROPS.join(', ')} (scale and opacity follow the loudness, blur flashes on each beat). source is the audio clip to follow (default: the longest audio clip); strength 0..1 (default per prop). Edit it afterwards with set_expression.`,
      inputSchema: z.object({ clip_id: z.string(), prop: z.enum(PULSE_PROPS), source: z.string().optional(), strength: z.number().min(0).max(1).optional() }),
      execute: async (input) => apply(pulseWithMusic(session.doc, input.clip_id, input.prop, { source: input.source, strength: input.strength }), `pulsed ${input.prop} of ${input.clip_id} with the music`)
    }),

    beat_times: tool({
      description: 'Where the music hits, on the timeline: the beat grid (hit: beats) or every detected onset (hit: onsets) of the Audio clips, in seconds from the start of the video. Use them to place cuts, keyframes and markers on the music.',
      inputSchema: z.object({ hit: z.enum([Hit.Beats, Hit.Onsets]).default(Hit.Beats) }),
      execute: async (input) => ({ ok: true, times: (await docBeats(input.hit)).map((f) => Math.round((f / session.doc.fps) * 1000) / 1000) })
    }),

    mark_beats: tool({
      description: 'Add a timeline marker on every beat (hit: beats, labelled "beat N") or every onset of the music (hit: onsets, "hit N"). Marking again replaces those markers; other markers stay. move_clip can then snap a clip to a marker by label.',
      inputSchema: z.object({ hit: z.enum([Hit.Beats, Hit.Onsets]).default(Hit.Beats) }),
      execute: async (input) => apply(markHits(session.doc, await docBeats(input.hit), input.hit), `marked the ${input.hit}`)
    }),

    cut_to_beat: tool({
      description: 'Re-time clips to the beat: in time order, the first starts on the nearest beat and each one ends on the beat nearest its length, the next starting there, so every cut lands on a beat. division half cuts on half beats too (a fast montage before the drop).',
      inputSchema: z.object({ clip_ids: z.array(z.string()).min(1), division: z.enum(Division).optional() }),
      execute: async (input) => apply(cutToBeat(session.doc, input.clip_ids, await docBeats(Hit.Beats), input.division), `cut ${input.clip_ids.length} clips to the beat`)
    }),

    duck_audio: tool({
      description: `Duck music under a voice-over: writes volume keyframes on the music clip so it drops while the voice speaks (its analysed speech regions, or the whole clip) and comes back after. depth is the music level under the voice as a fraction of its volume (default ${DUCK_DEFAULTS.depth}); attack/release in seconds (default ${DUCK_DEFAULTS.attack}/${DUCK_DEFAULTS.release}). Replaces the music's volume keyframes. Volume and pan of Audio/Video clips animate with set_keyframes too.`,
      inputSchema: z.object({
        music_clip_id: z.string(),
        voice_clip_id: z.string(),
        depth: z.number().min(0).max(1).optional(),
        attack: z.number().min(0).max(2).optional(),
        release: z.number().min(0).max(4).optional()
      }),
      execute: async (input) =>
        apply(duckUnder(session.doc, input.music_clip_id, input.voice_clip_id, await speechOf(input.voice_clip_id), { depth: input.depth, attack: input.attack, release: input.release }), `ducked ${input.music_clip_id} under ${input.voice_clip_id}`)
    }),

    remove_keyframes: tool({
      description: 'Remove the keyframes of one prop of a clip, all of them or only those at the given times (seconds from the clip start).',
      inputSchema: z.object({ clip_id: z.string(), prop: z.string(), times: z.array(z.number().min(0)).optional() }),
      execute: async (input) => apply(removeKeyframes(session.doc, input.clip_id, input.prop, input.times?.map(frames)), `removed keyframes of ${input.prop}`)
    }),

    set_mask: tool({
      description: `Mask a clip: only the inside of the mask shows (invert shows the outside). mode (${MASK_MODES.join(', ')}, default add) says how it folds into the masks stacked after it: a first mask that subtracts keeps the outside. kind: ${MASK_KIND_IDS.join(', ')}. x/y are the mask centre and width/height its size, in px of the frame; rotation in degrees; feather (blur) and expansion (grow, negative shrinks) in px; opacity in % (0..100). polygon takes points [[x,y],...] inside the mask box (0..1); image (alpha) and luma (brightness) take an assetId from list_assets; text takes text. Replaces the whole mask. Animate it with set_keyframes on ${MASK_KEYS.join(', ')}.`,
      inputSchema: z.object({
        clip_id: z.string(),
        mask: maskInput
      }),
      execute: async (input) => {
        if (!assetKnown(input.mask.assetId)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        return apply(registered(setMask(session.doc, input.clip_id, storedMask(ownerOf(input.clip_id), input.mask, session.doc)), input.mask.assetId), `masked ${input.clip_id}`);
      }
    }),

    set_mask_stack: tool({
      description: `Stack up to ${MAX_MASK_STACK} more masks after the clip's first mask (set_mask first), in order. Each folds into what the masks before it left, by its mode: add (union), subtract (cut it out), intersect (keep only the overlap), difference (keep where exactly one covers). Same fields as set_mask; stacked masks do not animate. Replaces the whole stack; [] clears it.`,
      inputSchema: z.object({ clip_id: z.string(), masks: z.array(maskInput).max(MAX_MASK_STACK) }),
      execute: async (input) => {
        const ids = input.masks.map((m) => m.assetId);
        if (!ids.every(assetKnown)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        return apply(ids.reduce((r, id) => registered(r, id), setMaskStack(session.doc, input.clip_id, input.masks.map((m) => storedMask(ownerOf(input.clip_id), m, session.doc)))), `stacked ${input.masks.length} masks on ${input.clip_id}`);
      }
    }),

    remove_mask: tool({
      description: 'Remove the mask of a clip, its stacked masks and its mask keyframes.',
      inputSchema: z.object({ clip_id: z.string() }),
      execute: async (input) => apply(setMask(session.doc, input.clip_id, null), `unmasked ${input.clip_id}`)
    }),

    set_track_matte: tool({
      description:
        'Use the clip directly above (on the track above, overlapping in time) as a matte for this clip. The matte is that clip as rendered, frame by frame: any kind (text, shape, picture, video, 3D, custom) with its keyframes and animation. alpha shows this clip where the matte is drawn, luma where it is bright; alpha-inverted and luma-inverted the opposite. The matte clip itself is hidden. none turns it off. Animated text over a video: Title on the upper track, Video below with matte alpha.',
      inputSchema: z.object({ clip_id: z.string(), matte: z.enum(MATTES) }),
      execute: async (input) => apply(setTrackMatte(session.doc, input.clip_id, input.matte), `matte ${input.matte} on ${input.clip_id}`)
    }),

    set_camera: tool({
      description: `Turn on the virtual camera of the video, change its base values, or turn it off (enabled false). With a camera, clips sit in a 3D world at their depth (set_clip_depth) and camera moves give parallax. Values: ${CAMERA_UNITS}. dof turns depth of field on.`,
      inputSchema: z.object({
        enabled: z.boolean().optional(),
        values: z.object(Object.fromEntries(CAMERA_KEYS.map((k) => [k, z.number().optional()]))).partial().optional(),
        dof: z.boolean().optional()
      }),
      execute: async (input) => {
        if (input.enabled === false) {
          return apply(removeCamera(session.doc), 'removed the camera');
        }
        const base = input.values && storedRecord(CAMERA_LANE, input.values, session.doc);
        return apply(setCamera(session.doc, { base: base as Partial<Record<(typeof CAMERA_KEYS)[number], number>>, dof: input.dof }), 'set the camera');
      }
    }),

    apply_device_preset: tool({
      description: `Animate a Device3D clip with a ready-made move over the clip: ${DEVICE_PRESETS.map((p) => `${p} — ${DEVICE_PRESET[p].about}`).join('; ')}. Replaces the keyframes it sets; presets combine (spin-in then screen-scroll).`,
      inputSchema: z.object({ clip_id: z.string(), preset: z.enum(DEVICE_PRESETS) }),
      execute: async (input) => apply(applyDevicePreset(session.doc, input.clip_id, input.preset), `${input.preset} on ${input.clip_id}`)
    }),

    add_particles: tool({
      description: `Add a Particles clip (seeded, deterministic emitter) from a preset: ${PARTICLE_PRESETS.map((p) => `${p} — ${PARTICLE_PRESET[p].about}`).join('; ')}. props override the preset (seed, emitter, shape, rate, life, speed, direction, spread, gravity, drag, wobble, spin, sizeStart/End, colorStart/End, opacityStart/End, softness, prewarm; list_components has the ranges). Every numeric and colour prop takes set_keyframes. ${PLACEMENT_HELP} Returns the clip id.`,
      inputSchema: z.object({ preset: z.enum(PARTICLE_PRESETS), start: z.number().min(0), duration: z.number().positive().optional(), props: z.record(z.string(), z.unknown()).optional(), ...PLACED_PICTURE }),
      execute: async (input) => {
        if (!assetKnown(input.props?.sprite)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        const id = deps.newId();
        const props = { ...PARTICLE_PRESET[input.preset].props, ...propsIn('Particles', input.props) };
        const result = addClip(session.doc, { component: 'Particles', from: frames(input.start), durationInFrames: input.duration ? frames(input.duration) : undefined, trackId: input.track_id, props }, id);
        return created(apply(withEffects(registered(result, input.props?.sprite), [id], input.effects), `added ${input.preset} particles`), id);
      }
    }),

    apply_particle_preset: tool({
      description: `Restyle a Particles clip with a preset (${PARTICLE_PRESETS.join(', ')}); its seed and keyframes are kept.`,
      inputSchema: z.object({ clip_id: z.string(), preset: z.enum(PARTICLE_PRESETS) }),
      execute: async (input) => apply(applyParticlePreset(session.doc, input.clip_id, input.preset), `${input.preset} particles on ${input.clip_id}`)
    }),

    add_liquid_glass: tool({
      description: `Add a drop of liquid glass on a new top track: a lens over everything below it that magnifies and bends what it covers (strongest at its rim), frosts it with a blur, and draws a lit rim and a specular highlight. All in px of the frame: x/y place its centre, diameter its size. path glides it on a spring through stops ({time in seconds from the clip start, x, y}; it holds each stop until the next one's time), spring ${Object.keys(SPRINGS).join('|')} ${SPRING_HELP} refraction 0..1 is the lens strength, frost the blur in px, rim the lit edge in px, tint and tint_amount colour it, wobble 0..0.2 and wobble_speed (Hz) make the outline breathe, fade_in/fade_out seconds fade the whole effect. Everything takes set_keyframes and set_expression afterwards (centerX, centerY, diameter, presence, refraction, frost, rim, tint, tintAmount, wobble, wobbleSpeed; centre and diameter as fractions of the frame), live input too: centerX "input.smooth(input.pointer.x, 0.15)" makes it follow the cursor in the interactive export. Returns the clip id.`,
      inputSchema: z.object({
        start: z.number().min(0),
        duration: z.number().positive(),
        x: z.number().optional(),
        y: z.number().optional(),
        diameter: z.number().positive().optional(),
        path: z.array(z.object({ time: z.number().min(0), x: z.number(), y: z.number() })).max(12).optional(),
        spring: z.enum(Object.keys(SPRINGS) as [keyof typeof SPRINGS, ...(keyof typeof SPRINGS)[]]).optional(),
        stiffness: z.number().positive().max(2000).optional(),
        damping: z.number().positive().max(200).optional(),
        refraction: z.number().min(0).max(1).optional(),
        frost: z.number().min(0).max(40).optional(),
        rim: z.number().min(0).max(12).optional(),
        tint: z.string().optional(),
        tint_amount: z.number().min(0).max(1).optional(),
        wobble: z.number().min(0).max(0.2).optional(),
        wobble_speed: z.number().min(0).max(4).optional(),
        fade_in: z.number().min(0).optional(),
        fade_out: z.number().min(0).optional()
      }),
      execute: async (input) => {
        const late = (input.path ?? []).find((s) => s.time > input.duration);
        if (late) {
          return { ok: false, error: `path stop at time ${late.time} is after the clip ends (${input.duration} s): times are seconds from the clip start` };
        }
        const given = { centerX: input.x, centerY: input.y, diameter: input.diameter, refraction: input.refraction, frost: input.frost, rim: input.rim, tint: input.tint, tintAmount: input.tint_amount, wobble: input.wobble, wobbleSpeed: input.wobble_speed };
        const props = propsIn('LiquidGlass', Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)));
        const path = (input.path ?? []).map((s) => ({ time: s.time, x: s.x / session.doc.width, y: s.y / session.doc.height }));
        const id = deps.newId();
        const glass = { from: frames(input.start), durationInFrames: frames(input.duration), props, path, spring: { ...SPRINGS[input.spring ?? 'soft'], ...(input.stiffness ? { stiffness: input.stiffness } : {}), ...(input.damping ? { damping: input.damping } : {}) }, fadeIn: frames(input.fade_in ?? 0), fadeOut: frames(input.fade_out ?? 0) };
        return created(apply(addLens(session.doc, Lens.Glass, glass, { clip: id, track: deps.newId() }), 'added liquid glass'), id);
      }
    }),

    add_liquid_blob: tool({
      description: `Add a real 3D drop of liquid glass on a new top track, rendered in WebGL over everything below it: true refraction through its curved surface (the content magnifies, bends and flips at the rim), chromatic dispersion, a soft studio reflection, sharp highlights, a thin lit rim, a soft shadow with a caustic. It wobbles, stretches along its motion and squashes when it stops. All in px of the frame: x/y its centre, diameter its size, split the distance between droplets. path glides it on a spring through stops ({time in seconds from the clip start, x, y}), spring ${Object.keys(SPRINGS).join('|')} ${SPRING_HELP} drops 1..${MAX_DROPS} with split > 0 break it into droplets along split_angle (degrees); keyframe split back to 0 and they melt into one (blend sets how far they melt). ior 1..2.4 (water 1.33, glass 1.5), dispersion 0..0.3, reflection 0..2, frost (px blur), tint and tint_amount colour the glass; viscosity 0..1, wobble 0..1, wobble_speed (Hz) and stretch 0..2 shape the liquid; seed changes the ripple. fade_in/fade_out seconds fade it. Everything takes set_keyframes and set_expression afterwards (${BLOB_NUMBER_KEYS.join(', ')}, tint; centre and diameter as fractions of the frame), live input too: centerX "input.smooth(input.pointer.x, 0.15)" makes it follow the cursor in the interactive export, stretching as it moves. Returns the clip id.`,
      inputSchema: z.object({
        start: z.number().min(0),
        duration: z.number().positive(),
        x: z.number().optional(),
        y: z.number().optional(),
        diameter: z.number().positive().optional(),
        path: z.array(z.object({ time: z.number().min(0), x: z.number(), y: z.number() })).max(12).optional(),
        spring: z.enum(Object.keys(SPRINGS) as [keyof typeof SPRINGS, ...(keyof typeof SPRINGS)[]]).optional(),
        stiffness: z.number().positive().max(2000).optional(),
        damping: z.number().positive().max(200).optional(),
        drops: z.number().int().min(1).max(MAX_DROPS).optional(),
        split: z.number().min(0).optional(),
        split_angle: z.number().optional(),
        blend: z.number().min(0.05).max(1.5).optional(),
        ior: z.number().min(1).max(2.4).optional(),
        dispersion: z.number().min(0).max(0.3).optional(),
        frost: z.number().min(0).max(40).optional(),
        reflection: z.number().min(0).max(2).optional(),
        tint: z.string().optional(),
        tint_amount: z.number().min(0).max(1).optional(),
        viscosity: z.number().min(0).max(1).optional(),
        wobble: z.number().min(0).max(1).optional(),
        wobble_speed: z.number().min(0).max(4).optional(),
        stretch: z.number().min(0).max(2).optional(),
        seed: z.number().int().min(0).max(999).optional(),
        fade_in: z.number().min(0).optional(),
        fade_out: z.number().min(0).optional()
      }),
      execute: async (input) => {
        const late = (input.path ?? []).find((s) => s.time > input.duration);
        if (late) {
          return { ok: false, error: `path stop at time ${late.time} is after the clip ends (${input.duration} s): times are seconds from the clip start` };
        }
        const given = Object.fromEntries(Object.entries(BLOB_INPUT).map(([arg, key]) => [key, input[arg as keyof typeof BLOB_INPUT]]));
        const props = propsIn('LiquidBlob', Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)));
        const path = (input.path ?? []).map((s) => ({ time: s.time, x: s.x / session.doc.width, y: s.y / session.doc.height }));
        const id = deps.newId();
        const blob = { from: frames(input.start), durationInFrames: frames(input.duration), props, path, spring: { ...SPRINGS[input.spring ?? 'soft'], ...(input.stiffness ? { stiffness: input.stiffness } : {}), ...(input.damping ? { damping: input.damping } : {}) }, fadeIn: frames(input.fade_in ?? 0), fadeOut: frames(input.fade_out ?? 0) };
        return created(apply(addLens(session.doc, Lens.Blob, blob, { clip: id, track: deps.newId() }), 'added liquid blob'), id);
      }
    }),

    set_time_remap: tool({
      description: `Retime a Video clip, in every render path. speed ${MIN_RATE}..${MAX_RATE} (1 = normal), reverse plays backwards; keyframes map clip time (seconds from the clip start) to source time (seconds into the video file) and win over speed/reverse: a ramp, a slow-mo, a jump back. clear: true returns to plain playback first. A retimed video is silent.`,
      inputSchema: z.object({
        clip_id: z.string(),
        clear: z.boolean().optional(),
        speed: z.number().min(MIN_RATE).max(MAX_RATE).optional(),
        reverse: z.boolean().optional(),
        keyframes: z.array(z.object({ time: z.number().min(0), source: z.number().min(0), ease: easeSchema.default(Ease.Linear), ...keyShape })).min(1).optional()
      }),
      execute: async (input) => {
        let result: OpResult = input.clear ? clearTimeRemap(session.doc, input.clip_id) : { ok: true, doc: session.doc };
        const playback = Object.fromEntries(Object.entries({ speed: input.speed, reverse: input.reverse }).filter(([, v]) => v !== undefined));
        if (result.ok && Object.keys(playback).length) {
          result = setProps(result.doc, input.clip_id, playback);
        }
        if (result.ok && input.keyframes) {
          result = setKeyframes(result.doc, input.clip_id, REMAP_KEY, input.keyframes.map((k) => asKey({ ...k, value: k.source })));
        }
        return apply(result, `retimed ${input.clip_id}`);
      }
    }),

    freeze_frame: tool({
      description: 'Freeze a Video clip on the source frame showing at a time of the video (seconds), for the whole clip. Split the clip first to freeze only a part, or use set_time_remap with a hold keyframe.',
      inputSchema: z.object({ clip_id: z.string(), at: z.number().min(0) }),
      execute: async (input) => apply(freezeFrame(session.doc, input.clip_id, frames(input.at)), `froze ${input.clip_id}`)
    }),

    add_device_row: tool({
      description: `Add three Device3D clips side by side that enter staggered and turn at different rates (parallax row). device: ${DEVICES.map((d) => `${d} (${DEVICE[d].label})`).join(', ')}. screens: up to three image asset ids, the first fills any missing. ${PLACEMENT_HELP} Returns the three clip ids.`,
      inputSchema: z.object({ device: z.enum(DEVICES), start: z.number().min(0), duration: z.number().positive(), screens: z.array(z.string()).max(3).default([]), ...PLACED_PICTURE }),
      execute: async (input) => {
        const ids = [deps.newId(), deps.newId(), deps.newId()];
        const row = addDeviceRow(session.doc, { device: input.device, screens: input.screens ?? [], from: frames(input.start), durationInFrames: frames(input.duration), ids, trackId: input.track_id });
        const out = apply(withEffects(row, ids, input.effects), `a row of ${input.device}`);
        return out.ok ? { ...out, clip_ids: ids } : out;
      }
    }),

    set_look: tool({
      description: `Set how 3D clips (3D model, 3D shape, 3D text, 3D logo) are lit: image-based environment (presets: ${ENV_PRESETS.map((p) => `${p} — ${HDRI[p].about}`).join('; ')}), its intensity (0–5) and rotation (degrees), soft shadow maps and a contact shadow under the object. enabled false removes the look (each clip falls back to its own lighting preset). Lights are added with set_light.`,
      inputSchema: z.object({
        enabled: z.boolean().optional(),
        environment: z.object({ preset: envPresetInput.optional(), intensity: z.number().optional(), rotation: z.number().optional() }).optional(),
        soft_shadows: z.boolean().optional(),
        contact_shadow: z.boolean().optional()
      }),
      execute: async (input) => {
        if (input.enabled === false) {
          return apply(removeLook(session.doc), 'removed the look');
        }
        return apply(setLook(session.doc, { environment: input.environment, softShadows: input.soft_shadows, contactShadow: input.contact_shadow }), 'set the look');
      }
    }),

    set_light: tool({
      description: `Add or edit a light of the 3D look by id (kind is required to add one): ${LIGHT_KINDS.join(', ')} (area is a soft rectangular panel, it casts no shadow map). Position x/y/z in scene units (the object is ~2 units wide at the origin, floor at y -1; range ${LIGHT.x.min}..${LIGHT.x.max}); intensity ${LIGHT.intensity.min}..${LIGHT.intensity.max} (directional ~1–2 with an environment, spot/point ~10–30 since they fade with distance). Lights point at the object.`,
      inputSchema: z.object({
        id: z.string().min(1).max(40),
        kind: z.enum(LIGHT_KINDS).optional(),
        color: z.string().optional(),
        intensity: z.number().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        z: z.number().optional(),
        cast_shadow: z.boolean().optional()
      }),
      execute: async ({ id, cast_shadow, ...patch }) => apply(setLight(session.doc, id, { ...patch, castShadow: cast_shadow }), `light ${id}`)
    }),

    remove_light: tool({
      description: 'Remove a light of the 3D look by id.',
      inputSchema: z.object({ id: z.string() }),
      execute: async (input) => apply(removeLight(session.doc, input.id), `removed light ${input.id}`)
    }),

    set_light_keyframes: tool({
      description: `Animate one value of a light: replaces its keyframes. time is seconds from the START OF THE VIDEO; ease as in set_keyframes. Props: ${LIGHT_KEYS.join(', ')}. An empty list removes the animation.`,
      inputSchema: z.object({
        id: z.string(),
        prop: z.enum(LIGHT_KEYS),
        keyframes: z.array(z.object({ time: z.number().min(0), value: z.number(), ease: easeSchema.default(Ease.Standard) }))
      }),
      execute: async (input) => apply(setLightKeyframes(session.doc, input.id, input.prop, input.keyframes.map((k) => ({ frame: frames(k.time), value: k.value, ease: k.ease }))), `animated light ${input.id} ${input.prop}`)
    }),

    set_camera_keyframes: tool({
      description: `Animate one camera value: replaces its keyframes. time is seconds from the START OF THE VIDEO (the camera spans the whole video); ease, in and out as in set_keyframes. Props: ${CAMERA_KEYS.join(', ')}. An empty list removes the animation.`,
      inputSchema: z.object({
        prop: z.enum(CAMERA_KEYS),
        keyframes: z.array(z.object({ time: z.number().min(0), value: z.number(), ease: easeSchema.default(Ease.Standard), in: keyShape.in, out: keyShape.out }))
      }),
      execute: async (input) => apply(setCameraKeyframes(session.doc, input.prop, input.keyframes.map(keyIn(CAMERA_LANE, input.prop))), `animated the camera ${input.prop}`)
    }),

    apply_camera_preset: tool({
      description: `Add a ready-made camera move between start and start+duration (seconds of the video); it starts from wherever the camera is then and keeps keys outside that span, so moves chain. Presets: ${CAMERA_PRESETS.map((p) => `${p} — ${PRESETS[p].about}`).join('; ')}. target is the depth the orbit, crane and dolly zoom aim at (default the focus distance).`,
      inputSchema: z.object({
        preset: z.enum(CAMERA_PRESETS),
        start: z.number().min(0),
        duration: z.number().positive(),
        amount: z.number().optional(),
        target: z.number().optional(),
        from_clip: z.string().optional(),
        to_clip: z.string().optional(),
        ease: easeSchema.optional()
      }),
      execute: async (input) =>
        apply(
          applyPreset(session.doc, input.preset, { start: frames(input.start), duration: frames(input.duration), amount: input.amount, target: input.target, from: input.from_clip, to: input.to_clip, ease: input.ease }),
          `camera ${input.preset}`
        )
    }),

    set_physics: tool({
      description: `Give a visual clip physics: it falls with gravity and bounces, simulated at a fixed step and baked per frame, so every seek and render shows the same motion. ${PHYSICS_KEYS.map((k) => `${k} ${toShown('Shape', k, PHYSICS[k].min, session.doc)}..${toShown('Shape', k, PHYSICS[k].max, session.doc)} ${unitOf('Shape', k) ?? ''}`.trim()).join('; ')} (restitution is the bounce, 100% keeps all the speed). bounds: ${BOUNDS.join(', ')} (floor bounces on the bottom of the frame, box on all four edges). collide true makes it bump into the other clips with collide on (AABB, mass decides who moves). The motion starts from where the clip is at its start and adds to its x/y. Values not given are kept; physics null turns it off.`,
      inputSchema: z.object({
        clip_id: z.string(),
        physics: z
          .object({ ...Object.fromEntries(PHYSICS_KEYS.map((k) => [k, z.number().optional()])), bounds: z.enum(BOUNDS).optional(), collide: z.boolean().optional() })
          .partial()
          .nullable()
      }),
      execute: async (input) => apply(setPhysics(session.doc, input.clip_id, input.physics && storedRecord(ownerOf(input.clip_id), input.physics, session.doc)), input.physics ? `physics on ${input.clip_id}` : `physics off on ${input.clip_id}`)
    }),

    apply_physics_preset: tool({
      description: `Give a visual clip a ready physics move: ${PHYSICS_PRESETS.map((p) => `${p} — ${PHYSICS_PRESET[p].about}`).join('; ')}. Tune it after with set_physics.`,
      inputSchema: z.object({ clip_id: z.string(), preset: z.enum(PHYSICS_PRESETS) }),
      execute: async (input) => apply(applyPhysicsPreset(session.doc, input.clip_id, input.preset), `${input.preset} physics on ${input.clip_id}`)
    }),

    set_clip_depth: tool({
      description: 'Place a clip in the camera world: depth in pixels behind the focus plane 0 (negative comes forward; a far background 1500–4000, a foreground card -200..0). It keeps its size at rest and shows parallax when the camera moves. space "screen" keeps a caption or overlay flat on top, ignoring the camera.',
      inputSchema: z.object({ clip_id: z.string(), depth: z.number().optional(), space: z.enum(SPACES).optional() }),
      execute: async (input) => apply(setClipDepth(session.doc, input.clip_id, { depth: input.depth, space: input.space }), `placed ${input.clip_id} in depth`)
    }),

    add_null: tool({
      description: 'Add a Null: an invisible handle that draws nothing. Parent clips to it (set_parent / parent_clips) and animate its transform (set_transform, set_keyframes on x, y, z, rotateX/Y/Z, scale, opacity) to move, turn or scale them together. x/y is its pivot in px of the frame. Returns the clip id.',
      inputSchema: z.object({ start: z.number().min(0), duration: z.number().positive().optional(), x: z.number().optional(), y: z.number().optional(), ...PLACED }),
      execute: async (input) => {
        const id = deps.newId();
        return created(apply(addNull(session.doc, { from: frames(input.start), durationInFrames: input.duration === undefined ? undefined : frames(input.duration), x: input.x === undefined ? undefined : toStored('Null', 'x', input.x, session.doc), y: input.y === undefined ? undefined : toStored('Null', 'y', input.y, session.doc), trackId: input.track_id }, id), 'added a null'), id);
      }
    }),

    set_parent: tool({
      description: 'Parent a clip to another visual clip or a Null (parent_id null unparents). The child keeps where it is on screen: its transform is recomputed relative to the parent at the child start. From then on the parent transform applies on top of the child at every frame; outside the parent time range its first or last keyframe holds. inherit_opacity false keeps the child opacity independent. Loops are refused.',
      inputSchema: z.object({ clip_id: z.string(), parent_id: z.string().nullable(), inherit_opacity: z.boolean().optional() }),
      execute: async (input) => {
        const parented = setParent(session.doc, input.clip_id, input.parent_id);
        const opacity = input.inherit_opacity === undefined || !parented.ok ? parented : setParentOpacity(parented.doc, input.clip_id, input.inherit_opacity ? ParentOpacity.Inherit : ParentOpacity.Ignore);
        return apply(opacity, input.parent_id ? `parented ${input.clip_id} to ${input.parent_id}` : `unparented ${input.clip_id}`);
      }
    }),

    parent_clips: tool({
      description: 'Parent several clips at once, keeping them where they are. Without parent_id a new Null is created at the centre of their boxes, spanning their time, and its id comes back as null_id: animate it to move the group.',
      inputSchema: z.object({ clip_ids: z.array(z.string()).min(1), parent_id: z.string().optional() }),
      execute: async (input) => {
        if (input.parent_id) {
          const parentId = input.parent_id;
          const result = input.clip_ids.reduce<OpResult>((r, id) => (r.ok ? setParent(r.doc, id, parentId) : r), { ok: true, doc: session.doc });
          return apply(result, `parented ${input.clip_ids.length} clip(s) to ${parentId}`);
        }
        const id = deps.newId();
        const out = apply(nullFromSelection(session.doc, input.clip_ids, Math.min(...input.clip_ids.map((c) => findClip(session.doc, c)?.clip.from ?? 0)), id), `grouped ${input.clip_ids.length} clip(s) under a null`);
        return out.ok ? { ...out, null_id: id } : out;
      }
    }),

    set_expression: tool({
      description: `Drive one number property with an expression evaluated at every frame, on top of its keyframes (value is the keyframed value). ${EXPRESSION_GUIDE} camera true targets the camera (props: ${CAMERA_KEYS.join(', ')}). expression null removes it.`,
      inputSchema: z.object({ clip_id: z.string().optional(), camera: z.boolean().optional(), prop: z.string(), expression: z.string().nullable() }),
      execute: async (input) => {
        if (input.camera) {
          return apply(setCameraExpression(session.doc, input.prop as (typeof CAMERA_KEYS)[number], input.expression), `camera ${input.prop} expression`);
        }
        return apply(setExpression(session.doc, input.clip_id ?? '', input.prop, input.expression), `${input.prop} expression on ${input.clip_id}`);
      }
    }),

    apply_interactive_preset: tool({
      description: `Make the interactive web export react: ${INTERACTIVE_PRESETS.map((p) => `${p} — ${PRESET[p].about}`).join('; ')}. Clip presets write expressions (edit them with set_expression); videos keep the default pose.`,
      inputSchema: z.object({ preset: z.enum(INTERACTIVE_PRESETS), clip_id: z.string().optional() }),
      execute: async (input) => apply(applyInteractivePreset(session.doc, input.preset, input.clip_id ?? null), `${input.preset} interactive preset`)
    }),

    set_interactive: tool({
      description: `How the interactive web export plays: playback ${PLAY_MODES.join('|')} (in-view plays while on screen, scrub ties the playhead to the scroll through a section scroll_length viewports tall (${SCROLL_LENGTH.min}..${SCROLL_LENGTH.max}, default ${SCROLL_LENGTH.default}) that the hosted embed builds itself; opened alone the embed scrolls itself), loop, and outside ${OUTSIDES.join('|')}: what a precomp reads when the cursor leaves its box (fallback = default pose, hold = last value).`,
      inputSchema: z.object({ playback: z.enum(PLAY_MODES).optional(), loop: z.boolean().optional(), outside: z.enum(OUTSIDES).optional(), scroll_length: interactiveSchema.shape.scrollLength.unwrap().optional() }),
      execute: async ({ scroll_length, ...input }) => apply(setInteractive(session.doc, Object.fromEntries(Object.entries({ ...input, scrollLength: scroll_length }).filter(([, v]) => v !== undefined))), 'changed interactive playback')
    }),

    export_interactive: tool({
      description: 'Check the interactive web export: lists the clip properties that react to live input, the playback settings and the embed snippet. The self-contained HTML file is downloaded by the user from Export → Interactive (web); publish_embed hosts it instead.',
      inputSchema: z.object({}),
      execute: async () => {
        const live = liveLanes(flattenComps(session.doc)).map((l) => ({ clip_id: l.id, prop: l.key }));
        return { ok: true, live, settings: interactiveOf(session.doc), snippet: fileSnippet(session.doc), note: live.length ? 'Ready: Export → Interactive (web) downloads the file.' : 'Nothing reads input yet: apply_interactive_preset or set_expression with input.*.' };
      }
    }),

    publish_embed: tool({
      description: 'Host the interactive web export on feega and return a snippet to paste into any site: the feega loader script and a <feega-motion> element that fills 100% of its box and keeps pointer, tilt and scroll working; playback and scroll length come from feega, not the snippet. Publishing again updates the same embed, so the site updates without a new paste. action unpublish takes it down.',
      inputSchema: z.object({ action: z.enum(EmbedAction).optional() }),
      execute: async (input) => (deps.embed ? deps.embed(input.action ?? EmbedAction.Publish) : { ok: false, error: 'hosting embeds is not available here' })
    }),

    add_shape: tool({
      description: `Add a vector Shape clip. kind: ${SHAPE_KINDS.join(', ')}; path takes ${PATH_GUIDE}. Fill: fillKind solid/linear/radial/none with fill, fill2 (gradient end) and gradientAngle; stroke: strokeKind none/solid/gradient, stroke, strokeWidth/dash/gap in px, cap, join. Other props as add_clip; a soft glow is effects [{kind: gaussian-blur}]. ${PLACEMENT_HELP} Returns the clip id.`,
      inputSchema: z.object({ kind: z.enum(SHAPE_KINDS), start: z.number().min(0), duration: z.number().positive().optional(), path: z.string().optional(), props: z.record(z.string(), z.unknown()).optional(), ...PLACED_PICTURE }),
      execute: async (input) => {
        const id = deps.newId();
        const outlined = input.props?.stroke !== undefined && input.props?.strokeKind === undefined ? { strokeKind: StrokeKind.Solid } : {};
        const props = { ...propsIn('Shape', { ...outlined, ...input.props }), shape: input.kind, ...(input.path ? { path: input.path } : {}) };
        const shape = addClip(session.doc, { component: 'Shape', from: frames(input.start), durationInFrames: input.duration ? frames(input.duration) : undefined, trackId: input.track_id, props }, id);
        return created(apply(withEffects(shape, [id], input.effects), `added ${input.kind} shape`), id);
      }
    }),

    set_path: tool({
      description: `Replace the outline of a Shape clip with ${PATH_GUIDE}. The clip becomes a free path.`,
      inputSchema: z.object({ clip_id: z.string(), path: z.string() }),
      execute: async (input) => apply(setPath(session.doc, input.clip_id, input.path), `set the path of ${input.clip_id}`)
    }),

    morph_to: tool({
      description: `Add a morph target to a Shape clip: a path (${PATH_GUIDE}) or a parametric kind (${SHAPE_KINDS.join(', ')}) with its roundness/sides/points/innerRadius. The shape morphs through its targets as its "morph" prop goes 0, 1, 2…; with start and end (seconds inside the clip) the morph to this target is keyed for you. morphStart (0..1) turns where the outlines start matching.`,
      inputSchema: z.object({
        clip_id: z.string(),
        path: z.string().optional(),
        kind: z.enum(SHAPE_KINDS).optional(),
        roundness: z.number().optional(),
        sides: z.number().optional(),
        points: z.number().optional(),
        innerRadius: z.number().optional(),
        start: z.number().min(0).optional(),
        end: z.number().min(0).optional()
      }),
      execute: async (input) =>
        apply(
          morphTo(session.doc, input.clip_id, { ...input, from: input.start === undefined ? undefined : frames(input.start), to: input.end === undefined ? undefined : frames(input.end) }),
          `morph target on ${input.clip_id}`
        )
    }),

    add_modifier: tool({
      description: `Add a modifier at the end of a Shape clip's stack (applied top to bottom). Kinds and params: ${MODIFIER_CATALOGUE}. trim start/end/offset draws a path on; repeater steps each copy by offset/rotation/scale around the box centre (rotation 360/copies makes a radial pattern); wiggle is seeded and moves with speed; wave ripples the edge (waves around it, Waves/s); blob swells the outline organically (lobes, speed, seed); goo melts near outlines together (Melt is the blur, Threshold the edge), best after a repeater or on a multi-part path. Returns modifier_id and the keys to animate with set_keyframes / set_expression: mod.<modifier id>.<param>.`,
      inputSchema: z.object({ clip_id: z.string(), kind: z.enum(MODIFIER_KINDS), params: z.record(z.string(), z.number()).optional() }),
      execute: async (input) => {
        const id = deps.newId();
        const out = apply(addModifier(session.doc, input.clip_id, input.kind, id, input.params), `added ${input.kind} to ${input.clip_id}`);
        return out.ok ? { ...out, modifier_id: id, animate: MODIFIERS[input.kind].params.map((p) => modifierKey(id, p.key)) } : out;
      }
    }),

    apply_shape_preset: tool({
      description: `Give a Shape clip a liquid look, replacing its modifiers and their keys: ${SHAPE_PRESETS.map((p) => `${p} — ${SHAPE_PRESET[p].about}`).join('; ')}. Tune it after with set_modifier.`,
      inputSchema: z.object({ clip_id: z.string(), preset: z.enum(SHAPE_PRESETS) }),
      execute: async (input) => apply(applyShapePreset(session.doc, input.clip_id, input.preset, deps.newId), `${input.preset} on ${input.clip_id}`)
    }),

    set_modifier: tool({
      description: 'Change a modifier of a Shape clip: some params (the rest are kept), enabled on/off, or its position in the stack (index 0 applies first).',
      inputSchema: z.object({ clip_id: z.string(), modifier_id: z.string(), params: z.record(z.string(), z.number()).optional(), enabled: z.boolean().optional(), index: z.number().int().min(0).optional() }),
      execute: async (input) => apply(setModifier(session.doc, input.clip_id, input.modifier_id, { params: input.params, enabled: input.enabled, index: input.index }), `changed modifier ${input.modifier_id}`)
    }),

    remove_modifier: tool({
      description: 'Remove a modifier from a Shape clip, with its keyframes and expressions.',
      inputSchema: z.object({ clip_id: z.string(), modifier_id: z.string() }),
      execute: async (input) => apply(removeModifier(session.doc, input.clip_id, input.modifier_id), `removed modifier ${input.modifier_id}`)
    }),

    add_effect: tool({
      description: `Add an effect at the end of a clip's effect stack (applied top to bottom, inside the clip transform). Kinds and params: ${EFFECT_CATALOGUE}. Params not given take their defaults. Returns effect_id and the keys to animate: set_keyframes / set_expression with prop fx.<effect id>.<param>.`,
      inputSchema: z.object({ clip_id: z.string(), kind: z.enum(EFFECT_KINDS), params: z.record(z.string(), z.union([z.number(), z.string()])).optional() }),
      execute: async (input) => {
        const id = deps.newId();
        const out = apply(addEffect(session.doc, input.clip_id, input.kind, id, input.params), `added ${input.kind} to ${input.clip_id}`);
        return out.ok ? { ...out, effect_id: id, animate: EFFECTS[input.kind].params.map((p) => effectKey(id, p.key)) } : out;
      }
    }),

    set_lut: tool({
      description: `Colour-grade a clip with a LUT: a preset (${LUT_PRESET_IDS.join(', ')}) or the text of a .cube file. Without effect_id it adds a LUT effect at the end of the stack; amount 0..1 mixes it (animate fx.<effect id>.amount). Pair with levels and lift-gamma-gain effects (add_effect).`,
      inputSchema: z.object({ clip_id: z.string(), effect_id: z.string().optional(), preset: z.enum(LUT_PRESET_IDS).optional(), cube: z.string().max(4_000_000).optional(), name: z.string().max(80).optional(), amount: z.number().min(0).max(1).optional() }),
      execute: async (input) => {
        const lut = input.cube ? lutFromCube(input.cube, input.name ?? 'custom') : input.preset ? compileLut(LUT_PRESETS[input.preset].look, input.preset) : 'give a preset or a .cube';
        if (typeof lut === 'string') {
          return { ok: false, error: lut };
        }
        const id = input.effect_id ?? deps.newId();
        const params: Record<string, number> = input.amount === undefined ? {} : { amount: input.amount };
        const added = input.effect_id ? setEffect(session.doc, input.clip_id, id, { params }) : addEffect(session.doc, input.clip_id, EffectKind.Lut, id, params);
        const out = apply(added.ok ? applyLut(added.doc, input.clip_id, id, lut) : added, `graded ${input.clip_id} with ${lut.name}`);
        return out.ok ? { ...out, effect_id: id } : out;
      }
    }),

    set_effect: tool({
      description: 'Change an effect of a clip: some params (the rest are kept), enabled on/off, or its position in the stack (index 0 applies first).',
      inputSchema: z.object({ clip_id: z.string(), effect_id: z.string(), params: z.record(z.string(), z.union([z.number(), z.string()])).optional(), enabled: z.boolean().optional(), index: z.number().int().min(0).optional() }),
      execute: async (input) => apply(setEffect(session.doc, input.clip_id, input.effect_id, { params: input.params, enabled: input.enabled, index: input.index }), `changed effect ${input.effect_id}`)
    }),

    remove_effect: tool({
      description: 'Remove an effect from a clip, with its keyframes and expressions.',
      inputSchema: z.object({ clip_id: z.string(), effect_id: z.string() }),
      execute: async (input) => apply(removeEffect(session.doc, input.clip_id, input.effect_id), `removed effect ${input.effect_id}`)
    }),

    write_effect: tool({
      description: `Write a custom effect for the whole workspace: a GLSL ES 1.0 fragment body defining vec4 effect(vec2 uv). Given: uniform sampler2D u_src (the clip picture), vec2 u_res (pixels), float u_time (clip seconds), float u_seed, varying v_uv, float hash(vec2), float noise(vec2). Every param becomes a uniform u_<key> (number → float, color → vec3, seed → float); keys src, res, time, seed are taken. No #extension, no derivatives, for loops with a constant bound ≤ 64, ≤ 16 texture2D, ≤ 12 KB. Same name replaces it. Returns the check (passed, failed with problems, or unchecked); fix and write again, at most three failed tries a turn. Then add_custom_effect.`,
      inputSchema: z.object({ name: z.string(), frag: z.string(), params: z.array(z.record(z.string(), z.unknown())).max(12).default([]) }),
      execute: async (input) => effectWrite((store) => store.write(input as never))
    }),

    patch_effect: tool({
      description: 'Edit a custom effect by text: edits [{find, replace}] applied in order on its frag, params replaces the list. version is the one list_effects or write_effect returned; a stale one answers conflict. Returns the new check.',
      inputSchema: z.object({ effect_id: z.string(), version: z.number().int(), edits: z.array(z.object({ find: z.string().min(1), replace: z.string() })).default([]), params: z.array(z.record(z.string(), z.unknown())).max(12).optional() }),
      execute: async (input) => effectWrite((store) => store.patch({ effectId: input.effect_id, version: input.version, edits: input.edits, params: input.params as never }))
    }),

    list_effects: tool({
      description: 'The custom effects of the workspace: id, name, version, params, check state and cost per 1080p frame. Free, reads only.',
      inputSchema: z.object({}),
      execute: async () => {
        const effects = deps.effects ? await deps.effects.list() : null;
        return { effects: (effects ?? []).map((e) => ({ effect_id: e.id, name: e.name, version: e.version, params: e.params, state: e.check.state, problems: e.check.problems, cost_ms: e.check.costMs })) };
      }
    }),

    write_layout: tool({
      description: `Write a custom composition layout for the whole workspace (same name replaces it). ${LAYOUT_SPEC_GUIDE} Then apply_layout on a Composition clip.`,
      inputSchema: z.object({ name: z.string(), spec: z.record(z.string(), z.unknown()) }),
      execute: async (input) => layoutWritten(deps.layouts ? await deps.layouts.write(input) : null)
    }),

    patch_layout: tool({
      description: 'Replace the spec of a custom layout at its version (list_layouts); a stale version answers conflict. Clips that use it keep their snapshot until apply_layout again.',
      inputSchema: z.object({ layout_id: z.string(), version: z.number().int(), spec: z.record(z.string(), z.unknown()) }),
      execute: async (input) => layoutWritten(deps.layouts ? await deps.layouts.patch({ layoutId: input.layout_id, version: input.version, spec: input.spec }) : null)
    }),

    list_layouts: tool({
      description: 'The custom composition layouts of the workspace: id, name, version, spec. Free, reads only.',
      inputSchema: z.object({}),
      execute: async () => ({ layouts: ((deps.layouts ? await deps.layouts.list() : null) ?? []).map((l) => ({ layout_id: l.id, name: l.name, version: l.version, spec: l.spec })) })
    }),

    apply_layout: tool({
      description: 'Arrange a Composition clip on a custom layout of the workspace (list_layouts / write_layout): its spec is copied into the clip, so the video renders with no workspace. layoutParams keep working for the params the spec declares.',
      inputSchema: z.object({ clip_id: z.string(), layout_id: z.string() }),
      execute: async (input) => {
        const layout = deps.layouts ? await deps.layouts.find(input.layout_id) : null;
        if (!layout) {
          return { ok: false, error: deps.layouts ? `no layout ${input.layout_id}: list_layouts shows the workspace's` : 'custom layouts are not available here' };
        }
        return apply(setProps(session.doc, input.clip_id, { layout: CUSTOM_LAYOUT, layoutRef: layout.id, layoutSpec: { ...layout.spec, name: layout.name } }), `arranged ${input.clip_id} on ${layout.name}`);
      }
    }),

    add_custom_effect: tool({
      description: `Put a custom effect of the workspace (write_effect / list_effects) on an Image or Video clip, one per clip. The shader runs on the picture first, then the clip's effect stack. Params not given take their defaults; animate them with set_keyframes on fx.<effect id>.<param>.`,
      inputSchema: z.object({ clip_id: z.string(), effect_id: z.string(), params: z.record(z.string(), z.union([z.number(), z.string()])).optional() }),
      execute: async (input) => {
        const effect = deps.effects ? await deps.effects.find(input.effect_id) : null;
        if (!effect) {
          return { ok: false, error: deps.effects ? `no custom effect ${input.effect_id}: list_effects shows the workspace's` : 'custom effects are not available here' };
        }
        const id = deps.newId();
        const snapshot = { name: effect.name, version: effect.version, frag: effect.frag, params: effect.params };
        const out = apply(addShader(session.doc, input.clip_id, id, { ref: effect.id, snapshot }, input.params), `added ${effect.name} to ${input.clip_id}`);
        return out.ok ? { ...out, custom_effect_id: id, check: effect.check.state, animate: effect.params.map((p) => effectKey(id, p.key)) } : out;
      }
    }),

    set_custom_effect: tool({
      description: 'Change a custom effect on a clip: some params (the rest are kept) or enabled on/off.',
      inputSchema: z.object({ clip_id: z.string(), custom_effect_id: z.string(), params: z.record(z.string(), z.union([z.number(), z.string()])).optional(), enabled: z.boolean().optional() }),
      execute: async (input) => apply(setShader(session.doc, input.clip_id, input.custom_effect_id, { params: input.params, enabled: input.enabled }), `changed custom effect ${input.custom_effect_id}`)
    }),

    remove_custom_effect: tool({
      description: 'Remove a custom effect from a clip, with its keyframes.',
      inputSchema: z.object({ clip_id: z.string(), custom_effect_id: z.string() }),
      execute: async (input) => apply(removeShader(session.doc, input.clip_id, input.custom_effect_id), `removed custom effect ${input.custom_effect_id}`)
    }),

    set_blend_mode: tool({
      description: `Blend a visual clip with the layers below it, like a layer mode in After Effects: ${BLEND_MODES.join(', ')}. normal turns it off. Blending is per clip (children do not inherit it); with the camera on, a blended world clip keeps its camera motion and paints over the world layers, blending with them.`,
      inputSchema: z.object({ clip_id: z.string(), mode: z.enum(BLEND_MODES) }),
      execute: async (input) => apply(setBlendMode(session.doc, input.clip_id, input.mode), `${input.mode} blend on ${input.clip_id}`)
    }),

    expose_field: tool({
      description: 'Expose a clip prop as a named template field (After Effects Essential Graphics): text, a custom component param, a colour, an asset slot. key is snake_case and names the CSV column a batch fills; default is the prop value now unless given. also lists more clip props the same value drives, e.g. one accent colour repeated in every scene.',
      inputSchema: z.object({ key: z.string().max(40), label: z.string().min(1).max(60), type: z.enum(FIELD_TYPES), clip_id: z.string(), prop: z.string().max(60), default: z.unknown().optional(), also: z.array(z.object({ clip_id: z.string(), prop: z.string().max(60) })).max(MAX_LINKED).optional() }),
      execute: async (input) =>
        apply(
          exposeField(session.doc, { key: input.key, label: input.label, type: input.type, clipId: input.clip_id, prop: input.prop, default: input.default, also: input.also?.map((t) => ({ clipId: t.clip_id, prop: t.prop })) }),
          `exposed field ${input.key}`
        )
    }),

    unexpose_field: tool({
      description: 'Remove an exposed template field. The clip keeps its value.',
      inputSchema: z.object({ key: z.string() }),
      execute: async (input) => apply(removeField(session.doc, input.key), `removed field ${input.key}`)
    }),

    list_fields: tool({
      description: 'List the exposed template fields with their clip, prop, type, default and current value. missing means its clip was deleted.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({ fields: fieldValues(session.doc) })
    }),

    render_batch: tool({
      description: `Render one video per data row on our servers, each row filling the exposed fields (keys as in list_fields; missing keys keep the default). Costs credits per video. First call with confirm false: it returns the quote; tell the user and call again with confirm true only after they agree. name_pattern names files with {{n}} (row number) and {{field_key}}. At most ${MAX_BATCH_ROWS} rows; the saved video is rendered, so edits of this turn must be saved first.`,
      inputSchema: z.object({ rows: z.array(z.record(z.string(), z.string())).min(1).max(MAX_BATCH_ROWS), name_pattern: z.string().max(120).default(DEFAULT_NAME_PATTERN), confirm: z.boolean() }),
      execute: async (input) => {
        const bad = input.rows.map((values, i) => [i, applyValues(session.doc, values)] as const).find(([, r]) => !r.ok);
        if (bad && !bad[1].ok) {
          return { ok: false, error: `row ${bad[0] + 1}: ${bad[1].error}` };
        }
        const rows = input.rows.map((values, i) => ({ name: outputName(input.name_pattern ?? DEFAULT_NAME_PATTERN, values, i + 1), values }));
        if (!input.confirm) {
          return { ok: false, needs_confirmation: true, rows: rows.length, credits: rows.length * renderQuote(session.doc).credits, names: rows.map((r) => r.name) };
        }
        if (!deps.batch) {
          return { ok: false, error: 'batch rendering is not available here' };
        }
        return deps.batch({ doc: session.doc, rows });
      }
    }),

    render_video: tool({
      description:
        'Render the saved video to an MP4 for free on the user\'s own device. Returns render_url: give it to the user as a markdown link titled "Render on this device"; they open it (on this or another device), it renders there and lands in the project assets. The link works once and expires in 30 minutes. The saved video is rendered, so edits of this turn must be saved first.',
      inputSchema: z.object({}).strict(),
      execute: async () => (deps.renderLink ? deps.renderLink() : { ok: false, error: 'rendering is not available here' })
    }),

    set_style: tool({
      description: `The motion style the video is directed in: ${MOTION_STYLES.map((m) => `${m} (${STYLES[m].label})`).join(', ')}. Launch film (minimal look, high energy) is the default; change it only when the user explicitly asks for another style. The quality gate in view_frames checks the effects the style forbids.`,
      inputSchema: z.object({ style: z.enum(MOTION_STYLES) }),
      execute: async (input) => apply({ ok: true, doc: { ...session.doc, style: input.style } }, `style ${input.style}`)
    }),

    set_motion_blur: tool({
      description: `Real motion blur, like After Effects: each frame averages sub-frame samples across the shutter, so fast moves smear. Video-wide: enabled, shutter_angle (degrees open, 180 is film), shutter_phase (degrees, -90 centres the shutter on the frame), samples (2..${MAX_SAMPLES}, 8 is enough for most moves; more costs more render time). Per clip: clip_ids with clips_blur false keeps those clips sharp. Renders on our servers in one pass, Video clips and device screens included; 3D clips make each sample slower, so long 3D shots allow fewer samples.`,
      inputSchema: z.object({
        enabled: z.boolean().optional(),
        shutter_angle: z.number().min(1).max(DEGREES).optional(),
        shutter_phase: z.number().min(-DEGREES).max(DEGREES).optional(),
        samples: z.number().int().min(2).max(MAX_SAMPLES).optional(),
        clip_ids: z.array(z.string()).optional(),
        clips_blur: z.boolean().optional()
      }),
      execute: async (input) => {
        const patch = Object.fromEntries(Object.entries({ enabled: input.enabled, shutterAngle: input.shutter_angle, shutterPhase: input.shutter_phase, samples: input.samples }).filter(([, v]) => v !== undefined));
        const shutter = setMotionBlur(session.doc, patch);
        const clips = shutter.ok && input.clip_ids ? setClipsBlur(shutter.doc, input.clip_ids, input.clips_blur ?? true) : shutter;
        return apply(clips, 'changed motion blur');
      }
    }),

    list_fonts: tool({
      description: `Search the Google Fonts catalogue (${GOOGLE_FONTS.length} families, most popular first): family, category, weights, italic. Built-ins: ${Object.values(BuiltinFont).join(', ')}. Fonts this video already has are in get_motion_doc fonts.`,
      inputSchema: z.object({ query: z.string().max(60).default(''), limit: z.number().int().min(1).max(MAX_FONT_RESULTS).default(DEFAULT_FONT_RESULTS) }),
      execute: async (input) => ({ fonts: searchFonts(GOOGLE_FONTS, input.query, [], input.limit).map((f) => ({ family: f.f, category: f.c, weights: f.w, italic: f.i === 1 })) })
    }),

    set_font: tool({
      description: `Set the font of a text clip (Title, Text, Kicker, Caption, ProductCard): any Google Fonts family (registered in the video automatically), an uploaded font, or a built-in (${Object.values(BuiltinFont).join(', ')}). weight ${FONT_WEIGHTS[0]}..${FONT_WEIGHTS[FONT_WEIGHTS.length - 1]}; the nearest weight the family has is used.`,
      inputSchema: z.object({ clip_id: z.string(), family: z.string().max(64), weight: z.number().int().min(100).max(900).optional(), italic: z.boolean().optional() }),
      execute: async (input) => apply(setFont(session.doc, input.clip_id, { family: input.family, weight: input.weight, italic: input.italic }, GOOGLE_FONTS), `font ${input.family} on ${input.clip_id}`)
    }),

    register_font: tool({
      description: 'Add a Google Fonts family to the video. Call it before add_clip names the family in props.font, and for a custom component font param (then set_props with that family).',
      inputSchema: z.object({ family: z.string().max(64) }),
      execute: async (input) => apply(registerFont(session.doc, input.family, GOOGLE_FONTS), `registered font ${input.family}`)
    }),

    remove_font: tool({
      description: 'Remove a font from the video. Refused while a clip uses it.',
      inputSchema: z.object({ family: z.string().max(64) }),
      execute: async (input) => apply(removeFont(session.doc, input.family), `removed font ${input.family}`)
    }),

    add_text_animator: tool({
      description: `Animate a text clip (Title, Text, Kicker, Caption) per character, word or line, like an After Effects text animator. The text is split into units; a range selector (start..end %, shifted by offset %, edges softened by softness 0..1 with shape square|ramp|smooth, order shuffled by seed) picks the units, and the selected ones get values: ${ANIMATOR_VALUES} (x/y in em, scale multiplier, rotation degrees, blur px, tracking em). Animate offset (or start/end) with set_keyframes on ta.<animator id>.offset to sweep the selection; every value is keyframable and expressionable the same way. Animators of one clip may use different units: the text splits by the finest and each piece also knows its word and line.`,
      inputSchema: z.object({ clip_id: z.string(), unit: z.enum(ANIMATOR_UNITS), ...animatorFields }),
      execute: async (input) => {
        const id = deps.newId();
        const { clip_id, ...animator } = input;
        const out = apply(addAnimator(session.doc, clip_id, id, animator as never), `text animator on ${clip_id}`);
        const values = Object.keys(input.values ?? {});
        return out.ok ? { ...out, animator_id: id, animate: [...SELECTOR_KEYS, ...values].map((k) => animatorKey(id, k)) } : out;
      }
    }),

    set_text_animator: tool({
      description: 'Change a text animator: shape, seed, start/end/offset/softness, values (merged; the rest are kept), or its order (index).',
      inputSchema: z.object({ clip_id: z.string(), animator_id: z.string(), unit: z.enum(ANIMATOR_UNITS).optional(), index: z.number().int().min(0).optional(), ...animatorFields }),
      execute: async (input) => {
        const { clip_id, animator_id, ...patch } = input;
        return apply(setAnimator(session.doc, clip_id, animator_id, patch as never), `changed text animator ${animator_id}`);
      }
    }),

    remove_text_animator: tool({
      description: 'Remove a text animator with its keyframes and expressions.',
      inputSchema: z.object({ clip_id: z.string(), animator_id: z.string() }),
      execute: async (input) => apply(removeAnimator(session.doc, input.clip_id, input.animator_id), `removed text animator ${input.animator_id}`)
    }),

    apply_text_preset: tool({
      description: `Add a ready-made text animation that plays between start and start+duration (seconds from the clip start): ${TEXT_PRESETS.map((p) => `${p} — ${TEXT_PRESET_SPECS[p].about}`).join('; ')}. Returns animator_id to tweak with set_text_animator.`,
      inputSchema: z.object({ clip_id: z.string(), preset: z.enum(TEXT_PRESETS), start: z.number().min(0).default(0), duration: z.number().positive().default(1) }),
      execute: async (input) => {
        const id = deps.newId();
        const out = apply(applyTextPreset(session.doc, input.clip_id, input.preset, { start: frames(input.start), duration: frames(input.duration) }, id), `${input.preset} on ${input.clip_id}`);
        return out.ok ? { ...out, animator_id: id } : out;
      }
    }),

    set_text_path: tool({
      description: `Put a text clip (Title, Text, Kicker, Caption) on a path, like After Effects Path Options. The path is a preset (${PATH_PRESETS.join(', ')}; radius px and arc degrees bend it: arc is the sweep of an arc and the phase sweep of a wave) or shape_clip_id, a Shape clip whose outline (pen paths, morphs and modifiers included) the text follows frame by frame, centred on the text box. align ${PATH_ALIGNS.join('|')}; firstMargin/lastMargin are % of the path length (animate firstMargin to slide the text along it, 100 = one turn of a closed path); reverse runs the text the other way (inside a circle); perpendicular false keeps glyphs upright; forceAlignment spreads the text from margin to margin. Every value animates with set_keyframes or set_expression on ${TEXT_PATH_KEYS.map((k) => textPathKey(k)).join(', ')} (booleans: 0/1, align: 0 start, 0.5 center, 1 end). Text animators keep working per character. Omitted fields keep their value.`,
      inputSchema: z.object({
        clip_id: z.string(),
        preset: z.enum(PATH_PRESETS).optional(),
        shape_clip_id: z.string().optional(),
        align: z.enum(PATH_ALIGNS).optional(),
        reverse: z.boolean().optional(),
        perpendicular: z.boolean().optional(),
        forceAlignment: z.boolean().optional(),
        firstMargin: z.number().min(TEXT_PATH.firstMargin.min).max(TEXT_PATH.firstMargin.max).optional(),
        lastMargin: z.number().min(TEXT_PATH.lastMargin.min).max(TEXT_PATH.lastMargin.max).optional(),
        radius: z.number().min(TEXT_PATH.radius.min).max(TEXT_PATH.radius.max).optional(),
        arc: z.number().min(TEXT_PATH.arc.min).max(TEXT_PATH.arc.max).optional()
      }),
      execute: async (input) => {
        const { clip_id, preset, shape_clip_id, forceAlignment, ...rest } = input;
        if (preset && shape_clip_id) {
          return { ok: false, error: 'pick one path: preset or shape_clip_id' };
        }
        const source: PathSource | undefined = preset ? { kind: PathSourceKind.Preset, preset } : shape_clip_id ? { kind: PathSourceKind.Clip, clip: shape_clip_id } : undefined;
        const out = apply(setTextPath(session.doc, clip_id, { ...rest, forceAlign: forceAlignment, source }), `text path on ${clip_id}`);
        return out.ok ? { ...out, animate: TEXT_PATH_KEYS.map((k) => textPathKey(k)) } : out;
      }
    }),

    remove_text_path: tool({
      description: 'Take a text clip off its path, with the path keyframes and expressions.',
      inputSchema: z.object({ clip_id: z.string() }),
      execute: async (input) => apply(removeTextPath(session.doc, input.clip_id), `removed text path from ${input.clip_id}`)
    }),

    add_track: tool({
      description: 'Add a visual or audio track, optionally named. A new visual track goes on top.',
      inputSchema: z.object({ kind: z.enum([TrackKind.Visual, TrackKind.Audio]), name: z.string().max(60).optional() }),
      execute: async (input) => apply(addTrack(session.doc, input.kind, deps.newId(), input.name), `added ${input.kind} track`)
    }),

    set_track: tool({
      description: 'Rename a track or move it in the stack (index 0 is the top track).',
      inputSchema: z.object({ track_id: z.string(), name: z.string().max(60).optional(), index: z.number().int().min(0).optional() }),
      execute: async (input) => {
        const renamed = input.name === undefined ? ({ ok: true, doc: session.doc } as OpResult) : renameTrack(session.doc, input.track_id, input.name);
        const moved = input.index === undefined || !renamed.ok ? renamed : moveTrack(renamed.doc, input.track_id, input.index);
        return apply(moved, `changed track ${input.track_id}`);
      }
    }),

    remove_track: tool({
      description: 'Remove a track and every clip on it.',
      inputSchema: z.object({ track_id: z.string() }),
      execute: async (input) => {
        const track = session.doc.tracks.find((t) => t.id === input.track_id);
        const cleared = track ? removeClips(session.doc, track.clips.map((c) => c.id)) : ({ ok: true, doc: session.doc } as OpResult);
        return apply(cleared.ok ? removeTrack(cleared.doc, input.track_id) : cleared, `removed track ${input.track_id}`);
      }
    }),

    set_canvas: tool({
      description: `Change the format (16:9, 9:16, 1:1, 4:5), the total duration in seconds (max ${MAX_SECONDS}; the server renders up to 60 s on free and Go, 120 s on Starter, 180 s on Pro) or the frame rate (${FRAME_RATES.join(', ')} fps; times keep their seconds). 30 fps is the social default, 24 reads as film, 60 makes fast motion smooth. background "transparent" drops the brand background so ProRes 4444, WebM and GIF exports keep alpha (an end card over footage).`,
      inputSchema: z.object({ format: z.enum(MOTION_FORMATS).optional(), duration: z.number().positive().max(MAX_SECONDS).optional(), fps: z.literal(FRAME_RATES).optional(), background: z.enum([Background.Brand, Background.Transparent]).optional() }),
      execute: async (input) => {
        const paced = input.fps === undefined ? ({ ok: true, doc: session.doc } as OpResult) : setFrameRate(session.doc, input.fps);
        const sized = paced.ok ? setCanvas(paced.doc, { format: input.format, durationInFrames: input.duration === undefined ? undefined : framesAt(input.duration, paced.doc.fps), background: input.background }) : paced;
        return apply(sized, 'changed the canvas');
      }
    }),

    analyze_site: tool({
      description: 'Read a public website for a brand: name, tagline, description, logos (svg first, then favicon, apple-touch-icon, og:image), palette (theme, logo, CSS), accent (hex and where it was found; hex null with a neutral palette when the brand has none), fonts (google true = usable by name after register_font), images with width and height (og, hero, product), store (shopify, woocommerce or none) with its real products from the public catalogue, and social links. Nothing is stored: import_asset the logo and the pictures you will use.',
      inputSchema: z.object({ url: z.string().min(4).max(2000).describe('the site, e.g. https://www.allbirds.com or allbirds.com') }),
      execute: async (input) => (deps.site ? readPages(readLogos(await deps.site(input.url))) : UNREADABLE('reading sites'))
    }),

    write_script: tool({
      description: `Save the research and the four-act script of a launch film before building it; the video is not built until this passes. Research: who it serves, the concrete problem, the struggle as an everyday scene, how the product works step by step (input → what happens → result), 1–3 benefits and up to 4 numbers or results, the tone, the promise. Every benefit, number, promise and proof cites its source: the url of a page analyze_site read and a quote copied from that page; a claim without a source on the site is refused, so never invent one. Acts ${ACTS.join(', ')} in order: problem shows the "before" UI, cluttered or slow, with realistic data; solution shows the product's real flow with specific content, written as a sequence of UI beats, one element per beat (the field and its typed text, the button pressed, the progress, the result); proof shows a number or result from the site; claim puts the site's own promise on screen. Keep on_screen lines few and short: each becomes its own full-frame title card, shown before the scene it announces, never over it. For an invented demo brand (no real site), set brand: fictional: no site is read and sources are the brand's own copy; the brief says it is fictional. Never use it for a real brand. The turn ends there: the user reads the brief in the chat, then says go or corrects it.`,
      inputSchema: scriptSchema,
      execute: async (raw) => {
        const parsed = scriptSchema.safeParse(raw);
        if (!parsed.success) {
          return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
        }
        const input = parsed.data;
        const sourcing = SOURCING[input.brand](input);
        if (sourcing.unread) {
          return { ok: false, error: 'read the site first: analyze_site gives the pages and quotes every claim must come from' };
        }
        const problems = [...scriptProblems(input), ...sourcing.problems];
        if (problems.length) {
          return { ok: false, error: problems.join('; ') };
        }
        const saved = apply({ ok: true, doc: { ...session.doc, script: input } }, 'saved the research and the script');
        return saved.ok ? { ok: true, brief: briefOf(input) } : saved;
      }
    }),

    write_storyboard: tool({
      description: 'Lay the film out as a storyboard: a canvas of its own, linked to this video, that the user opens full screen. One card per beat (act, kind, title, intent, on-screen text, emotion with intensity 0-1, duration, visual notes, music cue), left to right in story order, higher on the board the stronger the emotion, so the curve reads at a glance; branch_of (index of an earlier beat) puts an alternative under the beat it would replace. media hangs pictures or clips of this project (asset ids: captures, product shots, imports, generated) under a beat as visual notes. Write it right after write_script, from the same script. Writing again replaces the cards you placed before and keeps what the user added: read_storyboard first so their edits carry over.',
      inputSchema: storyboardSchema,
      execute: async (input) => {
        if (!deps.storyboard) {
          return UNREADABLE('the storyboard');
        }
        const media = boardMedia(input, deps.assets);
        if (!media.ok) {
          return { ok: false, error: `${media.error} (list_assets)` };
        }
        const written = await deps.storyboard.write(input, media.kinds);
        return { ok: true, canvas_id: written.canvasId, nodes: written.nodes, connections: written.connections, outline: outlineOf(input) };
      }
    }),

    read_storyboard: tool({
      description: "Read the storyboard of this video as it is now: its cards left to right (the user may have rewritten, moved or added some), the pictures and clips on it with their asset ids and the card each one feeds, and the flow between cards. Follow it when you build: the user's edits win over your script, and its media are assets you can place.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!deps.storyboard) {
          return UNREADABLE('the storyboard');
        }
        const read = await deps.storyboard.read();
        return read ? { ok: true, canvas_id: read.canvasId, cards: read.cards, media: read.media, flow: read.flow } : { ok: true, storyboard: null };
      }
    }),

    update_storyboard_card: tool({
      description: 'Rewrite the text of one card of the storyboard (node_id from read_storyboard).',
      inputSchema: z.object({ node_id: z.string(), text: z.string().min(1).max(4000) }),
      execute: async (input) => (deps.storyboard ? deps.storyboard.edit(input.node_id, input.text) : UNREADABLE('the storyboard'))
    }),

    link_storyboard_beat: tool({
      description: 'Tie a storyboard card to the clips that play it, once they are built: the card then opens the editor at that beat. Call it for every beat as you build the acts.',
      inputSchema: z.object({ node_id: z.string(), clip_ids: z.array(z.string()).min(1).max(20) }),
      execute: async (input) => {
        if (!deps.storyboard) {
          return UNREADABLE('the storyboard');
        }
        const missing = input.clip_ids.filter((id) => !findClip(session.doc, id));
        if (missing.length) {
          return { ok: false, error: `no clip ${missing.join(', ')} in this video` };
        }
        return deps.storyboard.link(input.node_id, input.clip_ids);
      }
    }),

    use_brand: tool({
      description: "Read a brand of this workspace: the project brand without a name, or the brand the user names. Returns name, website, logo url, palette, fonts, voice notes and products. import_asset its logo and product pictures to use them in clips.",
      inputSchema: z.object({ name: z.string().max(120).optional().describe('brand name or slug; omit for the project brand') }),
      execute: async (input) => (deps.brand ? readLogos(await deps.brand(input.name)) : UNREADABLE('reading brands'))
    }),

    import_asset: tool({
      description: 'Download a picture or logo from a public https url (PNG, JPEG, WebP, GIF, AVIF or SVG, max 12MB) into the project assets and return its asset_id for Image, Logo, Logo3D (SVG), ProductCard or Device3D screen. With capture desktop or mobile the url is a web page instead: it is photographed in a real browser at 2× (desktop 1440 px wide, mobile 390 px) and you get the top of the page and its key sections as sharp screenshots, one asset each. Use captures for UI and screens, never og:image or a small thumbnail.',
      inputSchema: z.object({ url: z.string().url().max(2000), label: z.string().max(60).optional(), capture: z.enum(CaptureView).optional() }),
      execute: async (input) => {
        if (input.capture) {
          const captured = deps.capture ? await deps.capture(input.url, input.capture) : UNREADABLE('capturing pages');
          if (!captured.ok) {
            return captured;
          }
          deps.assets.push(...captured.shots.map((s) => s.asset));
          return { ok: true, captures: captured.shots.map((s) => ({ asset_id: s.asset.id, part: s.part, width: s.width, height: s.height })) };
        }
        const imported = deps.importAsset ? await deps.importAsset(input.url, input.label) : UNREADABLE('importing pictures');
        if (!imported.ok) {
          return imported;
        }
        deps.assets.push(imported.asset);
        if (logoUrls.has(input.url)) {
          brandLogos.add(imported.asset.id);
        }
        return { ok: true, asset_id: imported.asset.id, kind: imported.asset.kind, width: imported.width, height: imported.height };
      }
    }),

    add_asset: tool({
      description: 'Register a project asset in the video so it renders with it. add_clip with an assetId does this too.',
      inputSchema: z.object({ asset_id: z.string() }),
      execute: async (input) => {
        const asset = deps.assets.find((a) => a.id === input.asset_id);
        if (!asset) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        return apply(registered({ ok: true, doc: session.doc }, asset.id), `registered asset ${asset.id}`);
      }
    }),

    remove_asset: tool({
      description: 'Unregister an asset from the video. Refused while a clip or mask still uses it.',
      inputSchema: z.object({ asset_id: z.string() }),
      execute: async (input) => apply(removeAsset(session.doc, input.asset_id), `unregistered asset ${input.asset_id}`)
    }),

    [READ_COMPONENT]: tool({
      description: 'Read the code (html, css, js), props schema, version and determinism check of a custom component.',
      inputSchema: z.object({ name: z.string() }),
      execute: async (input) => {
        const component = session.doc.components[input.name];
        if (!component) {
          return { ok: false, error: `no custom component ${input.name}; this video has ${Object.keys(session.doc.components).join(', ') || 'none'}` };
        }
        return { ok: true, name: input.name, ...component.source, props_schema: component.propsSchema, mode: modeOf(component), version: component.version, check: checkState(component), problems: component.check?.problems ?? [] };
      }
    }),

    mark_story: tool({
      description: `Mark where an act of the story starts (a timeline marker "story: <act>"). Every brand or product film tells four acts: problem (the user's pain, in the words of the site), solution (the product enters), proof (key features shown with live UI, numbers, results), claim (promise, original logo, address), about ${STORY_BEATS.map((b) => `${b} ${Math.round(STORY_SHARE[b] * 100)}%`).join(', ')} of the length. Marking an act again moves it.`,
      inputSchema: z.object({ beat: z.enum(STORY_BEATS), start: z.number().min(0) }),
      execute: async (input) => apply({ ok: true, doc: markStory(session.doc, input.beat, frames(input.start)) }, `marked the ${input.beat}`)
    }),

    add_ui: tool({
      description: `Recreate a piece of product UI live, as vector UI in the brand style, instead of a screenshot: ${UI_KINDS.map((k) => `${k} (${UI_KIT[k].about})`).join(' ')} Every piece also takes font, ink, muted, paper, line, accent (colours from analyze_site or use_brand), radius (px, the site's corners), zoom (size) and speed (1 = default timing). It animates itself across its duration; give it at least 2.5 s. Move, scale and keyframe the clip like any other (camera following the action).`,
      inputSchema: z.object({ kind: z.enum(UI_KINDS), start: z.number().min(0), duration: z.number().positive(), props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(), track_id: z.string().optional() }),
      execute: async (input) => {
        const piece = UI_KIT[input.kind];
        const written = session.doc.components[piece.name] ? { ok: true as const, doc: session.doc } : writeComponent(session.doc, piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });
        if (!written.ok) {
          return written;
        }
        const known = Object.keys(written.doc.components[piece.name].propsSchema.properties);
        const unknown = Object.keys(input.props ?? {}).filter((k) => !known.includes(k));
        if (unknown.length) {
          return { ok: false, error: `${piece.name} has no ${unknown.join(', ')}: its props are ${known.join(', ')}` };
        }
        const id = deps.newId();
        const placed = addClip(written.doc, { component: 'Custom', from: frames(input.start), durationInFrames: frames(input.duration), trackId: input.track_id, props: { name: piece.name, ...input.props } }, id);
        const shown = created(apply(placed, `added ${piece.name}`), id);
        return shown.ok ? { ...shown, anchors: Object.keys(anchorsOf(session.doc, id)?.anchors ?? {}) } : shown;
      }
    }),

    recreate_ui: tool({
      description: `Rebuild a product UI from a site capture as a sharp, vector, animatable component in the brand style, for any product the kit does not cover: a vision model reads the capture (or a region of it, fractions of the picture) into layout, blocks, real texts, colours, font and corners, and the component replays it: ${RECREATE_STATES.join('; ')}. With start and duration it also places the clip. Spends one code write.`,
      inputSchema: z.object({
        asset_id: z.string(),
        name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/).describe('PascalCase, e.g. UiEditor'),
        region: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).optional(),
        start: z.number().min(0).optional(),
        duration: z.number().positive().default(3),
        track_id: z.string().optional()
      }),
      execute: async (input, { toolCallId }) => {
        const asset = deps.assets.find((a) => a.id === input.asset_id && a.kind === AssetKind.Image);
        if (!asset) {
          return { ok: false, error: `no picture ${input.asset_id} in this project: capture the site first (import_asset with capture)` };
        }
        if (!deps.readUi) {
          return UNREADABLE('a vision model to read the capture');
        }
        const read = await deps.readUi(asset, input.region);
        if (!read.ok) {
          return read;
        }
        const piece = recreatedUi(input.name, read.structure);
        const written = await codeWrite(writeComponent(session.doc, piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } }), piece.name, `recreated ${piece.name}`, toolCallId);
        if (!written.ok) {
          return written;
        }
        const made = { ok: true, name: piece.name, structure: read.structure, params: Object.keys(session.doc.components[piece.name].propsSchema.properties), states: RECREATE_STATES };
        if (input.start === undefined) {
          return made;
        }
        const id = deps.newId();
        const placed = addClip(session.doc, { component: 'Custom', from: frames(input.start), durationInFrames: frames(input.duration), trackId: input.track_id, props: { name: piece.name, ...recreatedStyle(read.structure, fontRefProblem(read.structure.font, session.doc.fonts) === null) } }, id);
        const shown = apply(placed, `placed ${piece.name}`);
        return shown.ok ? { ...made, clip_id: id, anchors: Object.keys(anchorsOf(session.doc, id)?.anchors ?? {}) } : shown;
      }
    }),

    focus_ui: tool({
      description: 'Frame one part of a UI clip as its own beat: the clip scales and moves so the anchor (field, send, progress, done, button, input-0, heading-0, card-2…: add_ui and recreate_ui return them) lands in the centre at fill of the frame, on the house standard ease, starting at start (seconds of the video) over duration. isolate part (default) masks the clip down to that part alone (the rest of the screen disappears); context keeps the neighbours around it. Chain calls for the beats of one flow: the field and the typed text, then the button, then the progress bar, then the result; each call starts from where the last left, so the move between beats is a zoom from one part to the next.',
      inputSchema: z.object({ clip_id: z.string(), anchor: z.string(), start: z.number().min(0), duration: z.number().positive().default(0.6), fill: z.number().min(0.1).max(1).default(0.6), isolate: z.enum(Isolate).default(Isolate.Part) }),
      execute: async (input) => apply(focusUi(session.doc, { clipId: input.clip_id, anchor: input.anchor, at: frames(input.start), frames: frames(input.duration), fill: input.fill, isolate: input.isolate }), `focused ${input.clip_id}#${input.anchor}`)
    }),

    click_ui: tool({
      description: 'Lay a cursor that clicks named parts of UI clips (anchors such as send, cta, button, buy-1, toggle-0, card-2, input-0: add_ui and recreate_ui return them). Give each click the clip, the anchor and the second of the click on the video timeline; the cursor travels there and clicks exactly inside the part, following the clip scale, keyframes, parents, precomps and camera at that frame. Never place a cursor by guessed coordinates: the click-miss gate blocks a click outside the part it presses.',
      inputSchema: z.object({ clicks: z.array(z.object({ clip_id: z.string(), anchor: z.string(), at: z.number().min(0) })).min(1).max(12) }),
      execute: async (input) => {
        const id = deps.newId();
        const made = clickUi(session.doc, input.clicks.map((c) => ({ clipId: c.clip_id, anchor: c.anchor, at: c.at })), { clip: id, track: deps.newId() });
        return created(apply(made, `cursor clicks ${input.clicks.map((c) => `${c.clip_id}#${c.anchor}`).join(', ')}`), id);
      }
    }),

    ui_morph_reel: tool({
      description: `Build a looping UI morph reel: ONE shape morphing on springs through UI states (${MORPH_KINDS.join(', ')}; default order ${DEFAULT_REEL.join(', ')}), its content swapping with a short blur, a cursor clicking and dragging through every change, the camera zooming so each state fills the frame, one change every beats_per_change beats (2 by default: each state holds long enough to be read; the too-dense gate names events closer than a second). It sets the video length to the loop (e.g. 28 changes × 2 beats at 120 BPM = 28 s), the style ui-morph and the Geist font; the last frame flows into the first (the loop-seam gate checks it). offset is the time of the first beat (mark_beats on the music). props: ink, paper, accent, mute, canvas (colours), font, button, toast, track, artist (texts).`,
      inputSchema: z.object({ states: z.array(z.enum(MORPH_KINDS)).min(2).max(20).optional(), bpm: z.number().min(60).max(200).default(120), offset: z.number().min(0).max(4).default(0), beats_per_change: z.number().int().min(1).max(8).default(2), accent: z.string().optional(), props: z.record(z.string(), z.union([z.string(), z.number()])).optional() }),
      execute: async (input) => {
        const id = deps.newId();
        const props = { ...input.props, ...(input.accent ? { accent: input.accent } : {}) };
        return created(apply(addMorphReel(session.doc, { states: input.states ?? DEFAULT_REEL, bpm: input.bpm, offset: input.offset, pace: input.beats_per_change, props }, GOOGLE_FONTS, id), 'added a UI morph reel'), id);
      }
    }),

    [WRITE_COMPONENT]: tool({
      description: `Create or replace a custom component written in code. The editor runs it in a sandbox and checks that seeking gives the same frame from any direction (a live component: its video still); a failing check comes back as an error with the offending frames. Use it in clips with add_clip component "Custom", props { name, ...props }.`,
      inputSchema: z.object({
        mode: z.enum(ComponentMode).optional().describe('deterministic (default): every frame from tl, seekable, exact in the video. live: for games, generative pieces that differ on every view and interactive heroes meant for the website embed; runs its own loop (requestAnimationFrame, timers, Math.random) and reads input.x, input.y, input.down, input.keys, input.tiltX/Y, with onPause, onResume, onDestroy; gets the game engines LittleJS (LittleJS.engineInit(init, update, updatePost, render, renderPost)) and kaplay (const k = kaplay({ background: [0, 0, 0] })), and p5 loops on its own. The video shows a still of a live component: its first frame, seeded, or what it returns as { still(t) {} }'),
        name: z.string().describe('PascalCase, e.g. NodeGraph'),
        html: z.string().max(MAX_HTML).describe('markup inside the component root; no script, style, iframe, media or external urls'),
        css: z.string().max(MAX_CSS).describe('scoped to the component root (:scope is the root); no animation, transition, @keyframes, @import or external url()'),
        js: z.string().max(MAX_JS).describe('body of a function receiving root, props, tl, duration, fps, assets, brand, rand, format, motion, three, lottie, THREE, d3, p5, PIXI, Matter, gen, twgl, fx, Splitting, OpenProps; build every animation on tl, easing on "feega.out" (entrances), "feega.in" (exits) and "feega.inOut" (moves); "none" only for a drift, a loop or a driver tween, never sine, elastic, back or bounce. d3 is for data viz: scales, shapes and layouts, marks set in an onUpdate from progress, never d3 transitions or timers. p5 is for generative art: p5((p) => { p.setup = () => p.createCanvas(w, h); p.draw = () => { /* whole frame from p.frameCount / fps */ }; }) is redrawn on every seek with random and noise reseeded, never on its own loop. PIXI is for thousands of 2D sprites or particles: new PIXI.Application({ width, height }), root.appendChild(app.view), sprites placed in an onUpdate from this.time() ending with app.render(); no ticker. Matter is for physics: build the world once, const at = Matter.seekable(engine), then in onUpdate at(this.time()).get(body) gives { x, y, angle }; no Runner, no Render, no Engine.update. gen: seeded generative helpers — noise2D/3D/4D(), poisson({ shape, minDistance }), Delaunay (Voronoi), simplify, isect, RBush, KDBush, inside, ClipperLib. twgl is for custom WebGL2 shaders: twgl.webgl(canvas), createProgramInfo and buffers once, then setUniforms({ t: this.time() }) and drawBufferInfo in onUpdate. fx: seekable CSS effects driven by one variable on tl — gradient, border, grid (lines or dots), shimmer, grain, marquee. Splitting({ target, by }) (by chars, words, lines or cells) splits text with index variables; stagger on tl, or Splitting.drive(el) moves one --split variable. OpenProps: tokens var(--size-*), var(--shadow-*), var(--gradient-*), easings as tl ease names (ease-out-3, ease-spring-2), OpenProps.animate(el, name, { at, duration }) turns its keyframes into tl tweens. motion.drawPath(path), motion.morph(path, d), motion.scramble(el, text), motion.flip(els, change) return a handle: tween its draw, morph, reveal or flip from 0 to 1 on tl. Its own names never clash with these or with other components. Numbers on screen go through format.number(n, { decimals, group, point }), format.compact(n) (12.4K) or format.percent(ratio): toLocaleString and Intl differ between preview and render. ' + THREE_GUIDANCE),
        props_schema: z.union([propsSchemaSchema, z.string()]).optional().describe('optional: param() calls in js build it. ' + 'what a person may edit: { type: "object", properties: { key: { type: string|number|boolean, title, default, minimum, maximum, enum, format: color|textarea|asset } } }')
      }),
      execute: async (input, { toolCallId }) => {
        if (session.codeWrites >= MAX_CODE_WRITES_PER_TURN) {
          return { ok: false, error: `code budget for this turn is spent (${MAX_CODE_WRITES_PER_TURN} writes): finish with what you have` };
        }
        const schema = propsSchemaSchema.safeParse(typeof input.props_schema === 'string' ? parsedJson(input.props_schema) : (input.props_schema ?? { type: 'object', properties: {} }));
        if (!schema.success) {
          session.codeWrites += 1;
          return { ok: false, error: `props_schema: ${schema.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}` };
        }
        const draft = { source: { html: input.html, css: input.css, js: input.js }, propsSchema: schema.data, mode: input.mode };
        return codeWrite(writeComponent(session.doc, input.name, draft), input.name, `wrote ${input.name}`, toolCallId);
      }
    }),

    [PATCH_COMPONENT]: tool({
      description: 'Change a custom component by replacing text in one of its files; each find must occur exactly once. Cheaper than rewriting it. The determinism check runs again.',
      inputSchema: z.object({
        name: z.string(),
        edits: z.array(z.object({ file: z.enum(SOURCE_FILES), find: z.string().min(1), replace: z.string() })).min(1).max(20)
      }),
      execute: async (input, { toolCallId }) => codeWrite(patchComponent(session.doc, input.name, input.edits), input.name, `patched ${input.name}`, toolCallId)
    }),

    remove_component: tool({
      description: 'Delete a custom component no clip uses.',
      inputSchema: z.object({ name: z.string() }),
      execute: async (input) => apply(removeComponent(session.doc, input.name), `removed ${input.name}`)
    }),

    [VIEW_FRAMES]: tool({
      description: `See the video: the editor preview (or, with no editor open, a server-side browser) renders these exact times (seconds, up to ${MAX_FRAMES_PER_VIEW}) and you get the frames as images. Use it to check text that is clipped or overflows, overlaps, contrast and the safe area before and after edits.`,
      inputSchema: z.object({ times: z.array(z.number().min(0)).min(1).max(MAX_FRAMES_PER_VIEW) }),
      execute: async (input, { toolCallId }) => {
        if (session.views >= MAX_VIEWS_PER_TURN && session.checkedAt === session.edits.length) {
          return { ok: false, error: `frame budget for this turn is spent (${MAX_VIEWS_PER_TURN} views): finish with what you saw` };
        }
        session.views += 1;
        const end = session.doc.durationInFrames / session.doc.fps;
        const times = input.times.map((t) => Math.min(t, end));
        const frames = await deps.frames(toolCallId, times);
        if (!frames) {
          return { ok: true, seen: false, note: 'frames unavailable: neither the editor nor the server could draw them. Continue without them; the user sees the video when they open the editor.' };
        }
        session.frames.set(toolCallId, frames);
        session.checkedAt = session.edits.length;
        const stats = deps.inspect ? await deps.inspect(frames) : [];
        const audioAssets = deps.assets.filter((a) => a.kind === AssetKind.Audio).length;
        const pixels = assetPixels();
        session.gate = [...docProblems(session.doc, { audioAssets, pixels, logos: [...brandLogos] }), ...frameProblems(stats)];
        const quality = session.gate.map((p) => p.detail);
        const open = blocking(session.gate).map((p) => p.detail);
        return { ok: true, times: frames.map((f) => f.time), quality, blocking: open, note: open.length ? 'blocking lists what must be fixed before the video can be delivered: fix each one, then look again. The frames follow as images in the next message.' : quality.length ? 'The quality gate found the problems in quality: fix each one, then look again. The frames follow as images in the next message.' : 'The frames follow as images in the next message.' };
      }
    }),

    add_music: tool({
      description: 'Music under the whole video: a generated track when the workspace has a music generator, otherwise a CC0 track from the built-in library, chosen by mood and bpm. It lands on an Audio clip from 0 to the end and its beats are marked ("beat N"), ready for cut_to_beat. A launch film always has music.',
      inputSchema: z.object({ mood: z.enum(Mood), bpm: z.number().min(60).max(180).optional(), ...PLACED }),
      execute: async (input) => {
        if (!deps.music) {
          return UNREADABLE('music');
        }
        const seconds = session.doc.durationInFrames / session.doc.fps;
        const track = await deps.music({ mood: input.mood, bpm: input.bpm, seconds });
        if (!track.ok) {
          return { ok: false, error: track.error };
        }
        deps.assets.push({ id: track.assetId, kind: AssetKind.Audio, label: `music ${track.track}`, previewUrl: '', url: track.url });
        const id = deps.newId();
        const placed = apply(registered(addClip(session.doc, { component: 'Audio', from: 0, durationInFrames: session.doc.durationInFrames, trackId: input.track_id, props: { assetId: track.assetId } }, id), track.assetId), `added ${track.source} music ${track.track}`);
        if (!placed.ok) {
          return placed;
        }
        const marked = apply(markHits(session.doc, await docBeats(Hit.Beats), Hit.Beats), 'marked the beats');
        return { ...marked, clip_id: id, source: track.source, track: track.track };
      }
    }),

    compose_sound: tool({
      description: `Sound design under the music: a score of synth voices (${INSTRUMENTS.join(', ')}) and timed events, rendered offline to one audio track that preview and export play identically (same seed, same samples). Calling it again replaces the previous sound design: always send the whole score. at/duration in seconds; a whoosh starts ~0.3 s before the cut it covers, a hit or sub lands on the cut or peak, a riser ends on the reveal, a click sits on each click_ui tap, a pad holds under a scene. Keep it subtle under music (gain 0.2–0.5, music stays the lead), accent cuts and peaks only, never every beat. note is a name (C3, F#4) or Hz; brightness 0..1 opens the filter; reverb 0..1.`,
      inputSchema: z.object({ seed: z.number().int().min(0).optional(), bpm: z.number().min(40).max(220).optional(), voices: z.array(voiceSchema).min(1), events: z.array(eventSchema) }),
      execute: async (input) => {
        if (!deps.sound) {
          return UNREADABLE('sound design');
        }
        const score = soundScoreSchema.safeParse(input);
        if (!score.success) {
          return { ok: false, error: score.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
        }
        const stored = await deps.sound(score.data, session.doc.durationInFrames / session.doc.fps);
        if (!stored.ok) {
          return stored;
        }
        deps.assets.push({ id: stored.assetId, kind: AssetKind.Audio, label: 'sound design', previewUrl: '', url: stored.url });
        const laid = laySound(session.doc, { score: score.data, assetId: stored.assetId }, { clip: deps.newId(), track: deps.newId() });
        const out = apply(registered(laid, stored.assetId), `composed sound design (${score.data.events.length} events)`);
        return out.ok ? { ...out, clip_id: session.doc.sound?.clipId, events: score.data.events.length } : out;
      }
    }),

    generate_voiceover: tool({
      description: 'Spends credits. Turn a script into speech and place it as an Audio clip at a time in seconds. Only when the user asked for a voice-over.',
      inputSchema: z.object({ text: z.string().min(1).max(2000), start: z.number().min(0).default(0), voice_id: z.string().optional(), ...PLACED }),
      execute: async (input) => {
        const voice = await deps.voiceover({ text: input.text, voiceId: input.voice_id });
        if (!voice.ok) {
          return { ok: false, error: voice.error };
        }
        deps.assets.push({ id: voice.assetId, kind: AssetKind.Audio, label: 'voice-over', previewUrl: '', url: voice.url });
        const id = deps.newId();
        const result = addClip(session.doc, { component: 'Audio', from: frames(input.start), durationInFrames: Math.max(1, frames(voice.seconds)), trackId: input.track_id, props: { assetId: voice.assetId } }, id);
        return created(apply(registered(result, voice.assetId), 'added a voice-over'), id);
      }
    }),

    precompose: tool({
      description: 'Precompose: move clips (on video tracks) into a new nested composition and leave one Precomp clip in their place, spanning them. The composition starts at the first chosen clip. Edit what is inside with edit_comp; set_props on the Precomp sets loop (repeat to the end of the clip); trim_clip on its start shifts the composition time.',
      inputSchema: z.object({ clip_ids: z.array(z.string()).min(1), name: z.string().max(60).optional() }),
      execute: async (input) => {
        const comp = deps.newId();
        const clip = deps.newId();
        const out = apply(precompose(session.doc, input.clip_ids, { comp, clip }, input.name ?? `Comp ${Object.keys(session.doc.comps).length + 1}`), `precomposed ${input.clip_ids.length} clip(s)`);
        return out.ok ? { ...out, comp, clip_id: clip } : out;
      }
    }),

    create_comp: tool({
      description: 'Create an empty nested composition with its own frame size in px, e.g. a phone screen (390×848) for UI that a Device3D shows live with screenComp. Fill it with edit_comp: px inside it are px of this frame.',
      inputSchema: z.object({ name: z.string().max(60), width: z.number().int().min(16).max(MAX_SIDE), height: z.number().int().min(16).max(MAX_SIDE), duration: z.number().positive() }),
      execute: async (input) => {
        const comp = deps.newId();
        const out = apply(createComp(session.doc, comp, { name: input.name, durationInFrames: frames(input.duration), frame: { width: input.width, height: input.height } }), `created ${input.name}`);
        return out.ok ? { ...out, comp } : out;
      }
    }),

    edit_comp: tool({
      description: `Work inside a nested composition: runs the given tool calls in order, as if the composition were the whole video (its tracks, its length; ids are those inside it). Stops at the first call that fails, keeping what came before. Any tool works, e.g. {tool:"add_clip",input:{...}}, {tool:"set_keyframes",input:{...}}, {tool:"get_motion_doc",input:{}}. At most ${MAX_COMP_CALLS} calls.`,
      inputSchema: z.object({ comp: z.string(), calls: z.array(z.object({ tool: z.string(), input: z.record(z.string(), z.unknown()).default({}) })).max(MAX_COMP_CALLS) }),
      execute: async (input, options) => {
        const root = session.doc;
        if (!root.comps[input.comp]) {
          return { ok: false, error: `no composition ${input.comp}: compositions are ${Object.keys(root.comps).join(', ') || 'none (precompose first)'}` };
        }
        if (isLockedComp(root, input.comp)) {
          return { ok: false, error: `${input.comp} is a template: change it with set_template_fields, or detach_template first to edit its structure` };
        }
        session.doc = viewOf(root, [input.comp]);
        try {
          for (const [index, call] of input.calls.entries()) {
            const out = await nestedCall(call.tool, call.input, options);
            if (out.ok === false) {
              return { ok: false, failed: index, error: `${call.tool}: ${out.error}`, doc: docSummary(session.doc, []) };
            }
          }
          return { ok: true, doc: docSummary(session.doc, []) };
        } finally {
          session.doc = mergeView(root, [input.comp], session.doc);
        }
      }
    }),

    list_templates: tool({
      description: 'List the motion templates (built-in and saved by the team): fixed designs customised only through their fields — text, colours, media slots (aspect = width/height of the crop), numbers (min..max, unit), choices (options).',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        const entries = (await deps.templates?.list()) ?? [];
        return { templates: entries.map((e) => ({ id: e.id, name: e.template.name, description: e.template.description, seconds: secondsAt(e.template.doc.durationInFrames, e.template.doc.fps), fields: e.template.doc.fields.map(fieldSpec) })) };
      }
    }),

    insert_template: tool({
      description: 'Insert a template (id from list_templates) as one locked Precomp clip on a new top track at start seconds. Fill it with set_template_fields; its structure stays fixed unless detach_template.',
      inputSchema: z.object({ template_id: z.string(), start: z.number().min(0).default(0) }),
      execute: async (input) => {
        const entry = ((await deps.templates?.list()) ?? []).find((e) => e.id === input.template_id);
        if (!entry) {
          return { ok: false, error: `no template ${input.template_id}: call list_templates` };
        }
        const placed = insertTemplate(session.doc, entry, { from: frames(input.start), newId: deps.newId });
        if (!placed.ok) {
          return placed;
        }
        const out = apply(placed, `inserted template ${entry.template.name}`);
        return out.ok ? { ...out, clip_id: placed.clipId, fields: templateFields(session.doc, placed.clipId).map((f) => ({ ...fieldSpec(f), value: f.value })) } : out;
      }
    }),

    set_template_fields: tool({
      description: 'Set fields of an inserted template (clip_id of its Precomp clip; keys as in list_templates). Each value is checked against the field type: text, #rrggbb colour, asset id, number in range, one of the options, comma-separated asset ids for a media list.',
      inputSchema: z.object({ clip_id: z.string(), values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) }),
      execute: async (input) => {
        const values = Object.fromEntries(Object.entries(input.values).map(([k, v]) => [k, String(v)]));
        return apply(setTemplateValues(session.doc, input.clip_id, values), `set template fields ${Object.keys(values).join(', ')}`);
      }
    }),

    detach_template: tool({
      description: 'Detach an inserted template so its composition can be edited freely with edit_comp. Only when the user asks to change the structure.',
      inputSchema: z.object({ clip_id: z.string() }),
      execute: async (input) => apply(detachTemplate(session.doc, input.clip_id), `detached template ${input.clip_id}`)
    }),

    save_template: tool({
      description: 'Save a precomp (comp id) or, without comp, the whole video as a reusable team template. Its exposed fields (expose_field) become the template fields; at least one is required.',
      inputSchema: z.object({ name: z.string().min(1).max(60), description: z.string().max(200).default(''), comp: z.string().nullable().optional() }),
      execute: async (input) => {
        if (!deps.templates) {
          return { ok: false, error: 'the template library is not available here' };
        }
        const saved = await deps.templates.save({ doc: session.doc, compId: input.comp ?? null, meta: { name: input.name, description: input.description ?? '' }, posterFrame: 0 });
        return saved.ok ? { ok: true, template_id: saved.entry.id } : saved;
      }
    }),

    list_revisions: tool({
      description: 'List the saved versions of this video, newest first: version number, who saved it (user or agent), what changed, how many clips it had. Use it to find the version to restore_revision.',
      inputSchema: z.object({}).strict(),
      execute: async () => {
        if (!deps.revisions) {
          return { ok: false, error: 'version history is not available here' };
        }
        const entries = await deps.revisions.list();
        return { ok: true, revisions: entries.map((e) => ({ version: e.version, actor: e.actorKind, summary: e.summary, at: e.createdAt, clips: e.clips })) };
      }
    }),

    restore_revision: tool({
      description: 'Put a saved version of the video back (number from list_revisions). It replaces the whole doc, saved as a new version at the end of the turn: history is never deleted, and the user can undo the restore. When your edits broke the video, restore the last good version yourself instead of asking the user to undo.',
      inputSchema: z.object({ version: z.number().int().positive() }),
      execute: async (input) => {
        if (!deps.revisions) {
          return { ok: false, error: 'version history is not available here' };
        }
        const doc = await deps.revisions.read(input.version);
        if (!doc) {
          return { ok: false, error: `no version ${input.version}: call list_revisions` };
        }
        session.doc = doc;
        session.edits.push(`restored version ${input.version}`);
        return { ok: true, edit: `restored version ${input.version}`, doc: docSummary(session.doc, []) };
      }
    }),

    add_adjustment_layer: tool({
      description: 'Add an adjustment layer on a new top track: it draws nothing, and its effects (add_effect) and blend mode (set_blend_mode) apply to everything below it, only while it is on screen.',
      inputSchema: z.object({ start: z.number().min(0), duration: z.number().positive().optional() }),
      execute: async (input) => {
        const clip = deps.newId();
        const out = apply(addAdjustment(session.doc, { from: frames(input.start), durationInFrames: input.duration === undefined ? undefined : frames(input.duration) }, { clip, track: deps.newId() }), 'added an adjustment layer');
        return out.ok ? { ...out, clip_id: clip } : out;
      }
    })
  };

  async function nestedCall(name: string, raw: unknown, options: ToolExecutionOptions<unknown>): Promise<{ ok?: boolean; error?: unknown }> {
    const nested = tools[name] as (Tool & { execute?: (input: unknown, options: ToolExecutionOptions<unknown>) => Promise<unknown> }) | undefined;
    if (!nested?.execute) {
      return { ok: false, error: 'no such tool' };
    }
    const parsed = (nested.inputSchema as z.ZodType).safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ') };
    }
    return ((await nested.execute(parsed.data, options)) ?? {}) as { ok?: boolean; error?: unknown };
  }

  return { ...oneAtATime(tools), ...(deps.web ? createWebTools(deps.web) : {}) };
}

type Execute = (input: unknown, options: ToolExecutionOptions<unknown>) => Promise<unknown>;

function oneAtATime(tools: Record<string, Tool>): Record<string, Tool> {
  let queue: Promise<unknown> = Promise.resolve();
  const inTurn = (execute: Execute): Execute => (input, options) => {
    const run = queue.then(() => execute(input, options));
    queue = run.catch(() => undefined);
    return run;
  };
  return Object.fromEntries(Object.entries(tools).map(([name, t]) => [name, t.execute ? { ...t, execute: inTurn(t.execute as Execute) } : t]));
}

function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function selectionNote(doc: MotionDoc, selection: string[]): string {
  const clips = selection.map((id) => findClip(doc, id)?.clip).filter((c) => c !== undefined);
  if (!clips.length) {
    return 'Nothing is selected in the timeline.';
  }
  return `The user has selected: ${clips.map((c) => `${c.component} ${c.id} (${secondsAt(c.from, doc.fps)}s–${secondsAt(c.from + c.durationInFrames, doc.fps)}s)`).join(', ')}. "This", "it" or "the selected layer" mean these clips.`;
}
