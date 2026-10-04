import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { AssetKind, COMPONENTS, COMPONENT_IDS, TrackKind } from '$lib/motion/components';
import { fieldsOf } from '$lib/motion/inspector';
import { Ease, FRAME_RATES, MAX_SECONDS, TRANSITION_KINDS } from '$lib/motion/design';
import { setFrameRate } from '$lib/motion/frame-rate';
import { Background, MOTION_FORMATS, findClip, type MotionDoc } from '$lib/motion/doc';
import { ClipEdge, Side, addClip, addTrack, moveClip, moveTrack, removeClips, removeTrack, renameTrack, removeAsset, removeKeyframes, setCanvas, setKeyInterp, setKeyframes, setMask, shaped, setProps, setTiming, setTrackMatte, setTransform, setTransition, trimClip, type OpResult } from '$lib/motion/timeline';
import { MASK_KEYS, MASK_KIND_IDS, MATTES } from '$lib/motion/mask';
import { ANIMATABLE, INTERPS, SPATIAL_KEYS, TRANSFORM_KEYS, ValueKind, easeSchema, transformSchema, type Keyframe } from '$lib/motion/keyframes';
import type { MotionAsset } from './editor';
import { MAX_FRAMES_PER_VIEW, MAX_VIEWS_PER_TURN, VIEW_FRAMES, type Frame } from './frames';
import { CheckState, MAX_CSS, MAX_HTML, MAX_JS, SOURCE_FILES, checkState, propsSchemaSchema, sourceHash, type CustomComponent } from '$lib/motion/custom/component';
import { patchComponent, recordCheck, removeComponent, writeComponent } from '$lib/motion/custom/ops';
import { PATCH_COMPONENT, READ_COMPONENT, WRITE_COMPONENT } from './model-route';
import { CAMERA, CAMERA_KEYS, SPACES, type Camera } from '$lib/motion/camera';
import { CAMERA_PRESETS, PRESETS, applyPreset, removeCamera, setCamera, setCameraKeyframes, setClipDepth } from '$lib/motion/camera-ops';
import { ParentOpacity } from '$lib/motion/parent';
import { addNull, nullFromSelection, setParent, setParentOpacity } from '$lib/motion/parent-ops';
import { setCameraExpression, setExpression } from '$lib/motion/expression/ops';
import { EXPRESSION_GUIDE } from '$lib/motion/expression/guide';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { BuiltinFont, FONT_WEIGHTS, searchFonts } from '$lib/motion/fonts/model';
import { registerFont, removeFont, setFont } from '$lib/motion/fonts/ops';
import { EFFECTS, EFFECT_KINDS } from '$lib/motion/effects/registry';
import { addEffect, removeEffect, setEffect } from '$lib/motion/effects/ops';
import { effectKey } from '$lib/motion/effects/model';
import { BLEND_MODES } from '$lib/motion/blend';
import { ANIMATOR_UNITS, SELECTOR_SHAPES, SELECTOR_KEYS, VALUES, VALUE_KEYS, animatorKey } from '$lib/motion/text-animators/model';
import { PRESETS as TEXT_PRESET_SPECS, TEXT_PRESETS, addAnimator, applyPreset as applyTextPreset, removeAnimator, setAnimator } from '$lib/motion/text-animators/ops';
import { setBlendMode } from '$lib/motion/blend-ops';
import { setClipsBlur, setMotionBlur } from '$lib/motion/motion-blur-ops';
import { DEGREES, MAX_SAMPLES } from '$lib/motion/motion-blur';

export type MotionSession = { doc: MotionDoc; baseVersion: number; edits: string[]; selection: string[]; frames: Map<string, Frame[]>; views: number; checkedAt: number; codeWrites: number };

export type CheckResult = { ok: boolean; problems: string[]; frames: Frame[] };

export const MAX_CODE_WRITES_PER_TURN = 12;

export type Voiceover = { ok: true; assetId: string; seconds: number; url: string | null } | { ok: false; error: string };

export type MotionToolDeps = {
  session: MotionSession;
  assets: MotionAsset[];
  newId: () => string;
  voiceover: (input: { text: string; voiceId?: string }) => Promise<Voiceover>;
  frames: (callId: string, times: number[]) => Promise<Frame[] | null>;
  check: (callId: string, doc: MotionDoc, name: string) => Promise<CheckResult | null>;
};

const framesAt = (s: number, fps: number) => Math.round(s * fps);
const secondsAt = (f: number, fps: number) => Math.round((f / fps) * 100) / 100;

function summary(doc: MotionDoc, selection: string[]) {
  const secs = (f: number) => secondsAt(f, doc.fps);
  const edgeSummary = (edge: { kind: string; durationInFrames: number }) => ({ kind: edge.kind, duration: secs(edge.durationInFrames) });
  const inSeconds = (keyframes: Record<string, Keyframe[] | undefined>) =>
    Object.fromEntries(Object.entries(keyframes).map(([prop, track]) => [prop, (track ?? []).map(({ frame, ...rest }) => ({ time: secs(frame), ...rest }))]));
  const cameraSummary = (camera: Camera | null) => (camera ? { values: camera.base, dof: camera.dof, keyframes: inSeconds(camera.keyframes), expressions: camera.expressions } : null);

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
      clips: t.clips.map((c) => ({
        id: c.id,
        component: c.component,
        start: secs(c.from),
        duration: secs(c.durationInFrames),
        trimStart: secs(c.trimStart),
        props: c.props,
        in: edgeSummary(c.transitionIn),
        out: edgeSummary(c.transitionOut),
        transform: c.transform,
        mask: c.mask,
        matte: c.matte,
        keyframes: inSeconds(c.keyframes),
        depth: c.depth,
        space: c.space,
        parent: c.parent,
        parentOpacity: c.parentOpacity,
        expressions: c.expressions,
        effects: c.effects,
        blend: c.blend,
        animators: c.animators,
        motionBlur: c.motionBlur
      }))
    })),
    assets: doc.assets,
    fonts: doc.fonts,
    camera: cameraSummary(doc.camera),
    components: Object.entries(doc.components).map(([name, c]) => customSummary(name, c))
  };
}

const keyShape = { in: z.enum(INTERPS).optional(), out: z.enum(INTERPS).optional(), roving: z.boolean().optional() };

const INTERP_HELP = `in/out set how the value enters and leaves a keyframe: bezier (default, uses ease), linear, hold (no change until the next keyframe), auto (smooth, never overshoots), continuous (smooth, keeps speed through). roving true (${SPATIAL_KEYS.join(', ')} only) retimes a middle keyframe so the speed is even.`;

type KeyInput = { time: number; value: Keyframe['value']; ease: Keyframe['ease']; in?: Keyframe['in']; out?: Keyframe['out']; roving?: boolean };

const EFFECT_CATALOGUE = EFFECT_KINDS.map((k) => `${k} (${EFFECTS[k].about}; ${EFFECTS[k].params.map((p) => `${p.key} ${p.kind === ValueKind.Color ? 'colour' : `${p.min}..${p.max}`}`).join(', ')})`).join('; ');

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

const CAMERA_UNITS = `${CAMERA_KEYS.map((k) => `${k} ${CAMERA[k].min}..${CAMERA[k].max}`).join(', ')}. x/y are fractions of the frame, z is the dolly in pixels (positive moves forward), rotations and fov in degrees, focusDistance is the depth in focus (same units as clip depth), aperture the blur strength (px of blur per 100 px out of focus)`;

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
    library: libraryCatalogue(),
    custom: Object.entries(doc.components).map(([name, c]) => customSummary(name, c)),
    note: 'A custom component is used with add_clip component "Custom" and props { name, ...its props }.'
  };
}

function libraryCatalogue() {
  return COMPONENT_IDS.map((id) => ({
    id,
    track: COMPONENTS[id].track,
    about: COMPONENTS[id].description,
    animates: ANIMATABLE[id].map((p) => p.key),
    props: Object.fromEntries(fieldsOf(id).map((f) => [f.key, f.options ? f.options.join('|') : f.min !== undefined ? `${f.min}..${f.max}` : f.control]))
  }));
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
  const { session } = deps;
  const frames = (s: number) => framesAt(s, session.doc.fps);
  const asKey = (k: KeyInput): Keyframe => shaped({ frame: frames(k.time), value: k.value, ease: k.ease }, { in: k.in, out: k.out, roving: k.roving });

  const apply = (result: OpResult, what: string) => {
    if (!result.ok) {
      return { ok: false, error: explained(session.doc, result.error) };
    }
    session.doc = result.doc;
    session.edits.push(what);
    return { ok: true, doc: summary(session.doc, session.selection) };
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

  const assetKnown = (id: unknown) => typeof id !== 'string' || deps.assets.some((a) => a.id === id);

  const registered = (result: OpResult, assetId: unknown): OpResult => {
    const asset = deps.assets.find((a) => a.id === assetId);
    if (!result.ok || !asset || result.doc.assets.some((a) => a.id === asset.id)) {
      return result;
    }
    return { ok: true, doc: { ...result.doc, assets: [...result.doc.assets, { id: asset.id, kind: asset.kind, name: asset.label }] } };
  };

  return {
    get_motion_doc: tool({
      description: 'Read the video being edited: size, duration in seconds, tracks and clips (start/duration in seconds), and the clips the user has selected.',
      inputSchema: z.object({}).strict(),
      execute: async () => summary(session.doc, session.selection)
    }),

    list_components: tool({
      description: 'Every component a clip can use: the library (its track and props; x/y/width/height go 0..1) and the custom components written in code for this video.',
      inputSchema: z.object({}).strict(),
      execute: async () => componentCatalogue(session.doc)
    }),

    list_assets: tool({
      description: 'Images, videos, audio and 3D models of this project that clips can use, by id.',
      inputSchema: z.object({}).strict(),
      execute: async () => deps.assets.map((a) => ({ id: a.id, kind: a.kind, label: a.label }))
    }),

    add_clip: tool({
      description: 'Add a clip of a library component at a time in seconds. Props not given take the component defaults. Colours may be brand.primary/secondary/accent/background/text or #rrggbb.',
      inputSchema: z.object({
        component: z.enum(COMPONENT_IDS),
        start: z.number().min(0),
        duration: z.number().positive().optional(),
        track_id: z.string().optional(),
        props: z.record(z.string(), z.unknown()).optional()
      }),
      execute: async (input) => {
        if (!assetKnown(input.props?.assetId)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        const result = addClip(
          session.doc,
          { component: input.component, from: frames(input.start), durationInFrames: input.duration ? frames(input.duration) : undefined, trackId: input.track_id, props: input.props },
          deps.newId()
        );
        return apply(registered(result, input.props?.assetId), `added ${input.component}`);
      }
    }),

    set_timing: tool({
      description: 'Change when a clip starts and how long it lasts, in seconds.',
      inputSchema: z.object({ clip_id: z.string(), start: z.number().min(0).optional(), duration: z.number().positive().optional() }),
      execute: async (input) =>
        apply(setTiming(session.doc, input.clip_id, { from: input.start === undefined ? undefined : frames(input.start), durationInFrames: input.duration === undefined ? undefined : frames(input.duration) }), `retimed ${input.clip_id}`)
    }),

    set_props: tool({
      description: 'Change some props of a clip; the rest are kept. Validated against the component.',
      inputSchema: z.object({ clip_id: z.string(), props: z.record(z.string(), z.unknown()) }),
      execute: async (input) => {
        if (!assetKnown(input.props.assetId)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        const result = setProps(session.doc, input.clip_id, input.props);
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

    trim_clip: tool({
      description: 'Move the start or the end edge of a clip to a time in seconds, keeping the other edge.',
      inputSchema: z.object({ clip_id: z.string(), edge: z.enum([ClipEdge.Start, ClipEdge.End]), at: z.number().min(0) }),
      execute: async (input) => apply(trimClip(session.doc, input.clip_id, input.edge, frames(input.at)), `trimmed ${input.clip_id}`)
    }),

    move_clip: tool({
      description: 'Move a clip to a new start time, and optionally to another track of the same kind.',
      inputSchema: z.object({ clip_id: z.string(), start: z.number().min(0), track_id: z.string().optional() }),
      execute: async (input) => apply(moveClip(session.doc, input.clip_id, { from: frames(input.start), trackId: input.track_id }), `moved ${input.clip_id}`)
    }),

    remove_clip: tool({
      description: 'Remove one or more clips.',
      inputSchema: z.object({ clip_ids: z.array(z.string()).min(1) }),
      execute: async (input) => apply(removeClips(session.doc, input.clip_ids), `removed ${input.clip_ids.length} clip(s)`)
    }),

    set_transform: tool({
      description: `Set base transform values of a clip; the rest are kept. Keys: ${TRANSFORM_KEYS.join(', ')}. x/y are offsets in fractions of the frame, rotations and skews in degrees, z and perspective in pixels, anchorX/anchorY the pivot inside the clip box (0..1), blur in pixels.`,
      inputSchema: z.object({ clip_id: z.string(), transform: transformSchema }),
      execute: async (input) => apply(setTransform(session.doc, input.clip_id, input.transform), `transformed ${input.clip_id}`)
    }),

    set_keyframes: tool({
      description:
        `Animate one prop of a clip: replaces its keyframes. time is seconds from the clip start; ease is the curve leaving that keyframe (standard, enter, exit, linear, overshoot, or a cubic-bezier [x1,y1,x2,y2]). ${INTERP_HELP} Colour props take #rrggbb or brand colours. list_components says what each component animates.`,
      inputSchema: z.object({
        clip_id: z.string(),
        prop: z.string(),
        keyframes: z.array(z.object({ time: z.number().min(0), value: z.union([z.number(), z.string()]), ease: easeSchema.default(Ease.Standard), ...keyShape })).min(1)
      }),
      execute: async (input) => apply(setKeyframes(session.doc, input.clip_id, input.prop, input.keyframes.map(asKey)), `animated ${input.prop} of ${input.clip_id}`)
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

    remove_keyframes: tool({
      description: 'Remove the keyframes of one prop of a clip, all of them or only those at the given times (seconds from the clip start).',
      inputSchema: z.object({ clip_id: z.string(), prop: z.string(), times: z.array(z.number().min(0)).optional() }),
      execute: async (input) => apply(removeKeyframes(session.doc, input.clip_id, input.prop, input.times?.map(frames)), `removed keyframes of ${input.prop}`)
    }),

    set_mask: tool({
      description: `Mask a clip: only the inside of the mask shows (invert shows the outside). kind: ${MASK_KIND_IDS.join(', ')}. x/y are the mask centre and width/height its size, in fractions of the frame; rotation in degrees; feather (blur) and expansion (grow, negative shrinks) in pixels; opacity 0..1. polygon takes points [[x,y],...] inside the mask box (0..1); image (alpha) and luma (brightness) take an assetId from list_assets; text takes text. Replaces the whole mask. Animate it with set_keyframes on ${MASK_KEYS.join(', ')}.`,
      inputSchema: z.object({
        clip_id: z.string(),
        mask: z
          .object({
            kind: z.enum(MASK_KIND_IDS),
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
          .strict()
      }),
      execute: async (input) => {
        if (!assetKnown(input.mask.assetId)) {
          return { ok: false, error: 'unknown asset id: call list_assets' };
        }
        return apply(registered(setMask(session.doc, input.clip_id, input.mask), input.mask.assetId), `masked ${input.clip_id}`);
      }
    }),

    remove_mask: tool({
      description: 'Remove the mask of a clip and its mask keyframes.',
      inputSchema: z.object({ clip_id: z.string() }),
      execute: async (input) => apply(setMask(session.doc, input.clip_id, null), `unmasked ${input.clip_id}`)
    }),

    set_track_matte: tool({
      description:
        'Use the clip directly above (on the track above, overlapping in time) as a matte for this clip: alpha shows this clip only where that clip is drawn (text, shape, picture), luma where it is bright. The matte clip is hidden. none turns it off.',
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
        return apply(setCamera(session.doc, { base: input.values as Partial<Record<(typeof CAMERA_KEYS)[number], number>>, dof: input.dof }), 'set the camera');
      }
    }),

    set_camera_keyframes: tool({
      description: `Animate one camera value: replaces its keyframes. time is seconds from the START OF THE VIDEO (the camera spans the whole video); ease, in and out as in set_keyframes. Props: ${CAMERA_KEYS.join(', ')}. An empty list removes the animation.`,
      inputSchema: z.object({
        prop: z.enum(CAMERA_KEYS),
        keyframes: z.array(z.object({ time: z.number().min(0), value: z.number(), ease: easeSchema.default(Ease.Standard), in: keyShape.in, out: keyShape.out }))
      }),
      execute: async (input) => apply(setCameraKeyframes(session.doc, input.prop, input.keyframes.map(asKey)), `animated the camera ${input.prop}`)
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

    set_clip_depth: tool({
      description: 'Place a clip in the camera world: depth in pixels behind the focus plane 0 (negative comes forward; a far background 1500–4000, a foreground card -200..0). It keeps its size at rest and shows parallax when the camera moves. space "screen" keeps a caption or overlay flat on top, ignoring the camera.',
      inputSchema: z.object({ clip_id: z.string(), depth: z.number().optional(), space: z.enum(SPACES).optional() }),
      execute: async (input) => apply(setClipDepth(session.doc, input.clip_id, { depth: input.depth, space: input.space }), `placed ${input.clip_id} in depth`)
    }),

    add_null: tool({
      description: 'Add a Null: an invisible handle that draws nothing. Parent clips to it (set_parent / parent_clips) and animate its transform (set_transform, set_keyframes on x, y, z, rotateX/Y/Z, scale, opacity) to move, turn or scale them together. x/y is its pivot in fractions of the frame.',
      inputSchema: z.object({ start: z.number().min(0), duration: z.number().positive().optional(), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(), track_id: z.string().optional() }),
      execute: async (input) => apply(addNull(session.doc, { from: frames(input.start), durationInFrames: input.duration === undefined ? undefined : frames(input.duration), x: input.x, y: input.y, trackId: input.track_id }, deps.newId()), 'added a null')
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

    add_effect: tool({
      description: `Add an effect at the end of a clip's effect stack (applied top to bottom, inside the clip transform). Kinds and params: ${EFFECT_CATALOGUE}. Params not given take their defaults. Returns effect_id and the keys to animate: set_keyframes / set_expression with prop fx.<effect id>.<param>.`,
      inputSchema: z.object({ clip_id: z.string(), kind: z.enum(EFFECT_KINDS), params: z.record(z.string(), z.union([z.number(), z.string()])).optional() }),
      execute: async (input) => {
        const id = deps.newId();
        const out = apply(addEffect(session.doc, input.clip_id, input.kind, id, input.params), `added ${input.kind} to ${input.clip_id}`);
        return out.ok ? { ...out, effect_id: id, animate: EFFECTS[input.kind].params.map((p) => effectKey(id, p.key)) } : out;
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

    set_blend_mode: tool({
      description: `Blend a visual clip with the layers below it, like a layer mode in After Effects: ${BLEND_MODES.join(', ')}. normal turns it off. Blending is per clip (children do not inherit it); with the camera on, a blended world clip keeps its camera motion and paints over the world layers, blending with them.`,
      inputSchema: z.object({ clip_id: z.string(), mode: z.enum(BLEND_MODES) }),
      execute: async (input) => apply(setBlendMode(session.doc, input.clip_id, input.mode), `${input.mode} blend on ${input.clip_id}`)
    }),

    set_motion_blur: tool({
      description: `Real motion blur, like After Effects: each frame averages sub-frame samples across the shutter, so fast moves smear. Video-wide: enabled, shutter_angle (degrees open, 180 is film), shutter_phase (degrees, -90 centres the shutter on the frame), samples (2..${MAX_SAMPLES}, 8 is enough for most moves; more costs more render time). Per clip: clip_ids with clips_blur false keeps those clips sharp. Renders on our servers in one pass; videos with Video clips cannot blur.`,
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
      description: 'Add a Google Fonts family to the video without using it yet, e.g. for a custom component font param (then set_props with that family).',
      inputSchema: z.object({ family: z.string().max(64) }),
      execute: async (input) => apply(registerFont(session.doc, input.family, GOOGLE_FONTS), `registered font ${input.family}`)
    }),

    remove_font: tool({
      description: 'Remove a font from the video. Refused while a clip uses it.',
      inputSchema: z.object({ family: z.string().max(64) }),
      execute: async (input) => apply(removeFont(session.doc, input.family), `removed font ${input.family}`)
    }),

    add_text_animator: tool({
      description: `Animate a text clip (Title, Text, Kicker, Caption) per character, word or line, like an After Effects text animator. The text is split into units; a range selector (start..end %, shifted by offset %, edges softened by softness 0..1 with shape square|ramp|smooth, order shuffled by seed) picks the units, and the selected ones get values: ${ANIMATOR_VALUES} (x/y in em, scale multiplier, rotation degrees, blur px, tracking em). Animate offset (or start/end) with set_keyframes on ta.<animator id>.offset to sweep the selection; every value is keyframable and expressionable the same way. All animators of a clip share one unit.`,
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

    add_track: tool({
      description: 'Add a visual or audio track. A new visual track goes on top.',
      inputSchema: z.object({ kind: z.enum([TrackKind.Visual, TrackKind.Audio]) }),
      execute: async (input) => apply(addTrack(session.doc, input.kind, deps.newId()), `added ${input.kind} track`)
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
        return { ok: true, name: input.name, ...component.source, props_schema: component.propsSchema, version: component.version, check: checkState(component), problems: component.check?.problems ?? [] };
      }
    }),

    [WRITE_COMPONENT]: tool({
      description: `Create or replace a custom component written in code. The editor runs it in a sandbox and checks that seeking gives the same frame from any direction; a failing check comes back as an error with the offending frames. Use it in clips with add_clip component "Custom", props { name, ...props }.`,
      inputSchema: z.object({
        name: z.string().describe('PascalCase, e.g. NodeGraph'),
        html: z.string().max(MAX_HTML).describe('markup inside the component root; no script, style, iframe, media or external urls'),
        css: z.string().max(MAX_CSS).describe('scoped to the component root (:scope is the root); no animation, transition, @keyframes, @import or external url()'),
        js: z.string().max(MAX_JS).describe('body of a function receiving root, props, tl, duration, fps, assets, brand, rand, gsap, SplitText, lottie, THREE; build every animation on tl'),
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
        const draft = { source: { html: input.html, css: input.css, js: input.js }, propsSchema: schema.data };
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
      description: `See the video: the editor preview renders these exact times (seconds, up to ${MAX_FRAMES_PER_VIEW}) and you get the frames as images. Use it to check text that is clipped or overflows, overlaps, contrast and the safe area before and after edits.`,
      inputSchema: z.object({ times: z.array(z.number().min(0)).min(1).max(MAX_FRAMES_PER_VIEW) }),
      execute: async (input, { toolCallId }) => {
        if (session.views >= MAX_VIEWS_PER_TURN) {
          return { ok: false, error: `frame budget for this turn is spent (${MAX_VIEWS_PER_TURN} views): finish with what you saw` };
        }
        session.views += 1;
        const end = session.doc.durationInFrames / session.doc.fps;
        const times = input.times.map((t) => Math.min(t, end));
        const frames = await deps.frames(toolCallId, times);
        if (!frames) {
          return { ok: false, error: 'no editor preview answered: the frames cannot be seen right now, continue without them' };
        }
        session.frames.set(toolCallId, frames);
        session.checkedAt = session.edits.length;
        return { ok: true, times: frames.map((f) => f.time), note: 'The frames follow as images in the next message.' };
      }
    }),

    generate_voiceover: tool({
      description: 'Spends credits. Turn a script into speech and place it as an Audio clip at a time in seconds. Only when the user asked for a voice-over.',
      inputSchema: z.object({ text: z.string().min(1).max(2000), start: z.number().min(0).default(0), voice_id: z.string().optional() }),
      execute: async (input) => {
        const voice = await deps.voiceover({ text: input.text, voiceId: input.voice_id });
        if (!voice.ok) {
          return { ok: false, error: voice.error };
        }
        deps.assets.push({ id: voice.assetId, kind: AssetKind.Audio, label: 'voice-over', previewUrl: '', url: voice.url });
        const result = addClip(session.doc, { component: 'Audio', from: frames(input.start), durationInFrames: Math.max(1, frames(voice.seconds)), props: { assetId: voice.assetId } }, deps.newId());
        return apply(registered(result, voice.assetId), 'added a voice-over');
      }
    })
  };
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
