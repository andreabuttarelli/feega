import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { AssetKind, COMPONENTS, COMPONENT_IDS, TrackKind } from '$lib/motion/components';
import { fieldsOf } from '$lib/motion/inspector';
import { FPS, TRANSITION_KINDS } from '$lib/motion/design';
import { MOTION_FORMATS, findClip, type MotionDoc } from '$lib/motion/doc';
import { ClipEdge, Side, addClip, addTrack, moveClip, removeClips, setCanvas, setProps, setTiming, setTransition, trimClip, type OpResult } from '$lib/motion/timeline';
import type { MotionAsset } from './editor';

export type MotionSession = { doc: MotionDoc; baseVersion: number; edits: string[]; selection: string[] };

export type Voiceover = { ok: true; assetId: string; seconds: number; url: string | null } | { ok: false; error: string };

export type MotionToolDeps = {
  session: MotionSession;
  assets: MotionAsset[];
  newId: () => string;
  voiceover: (input: { text: string; voiceId?: string }) => Promise<Voiceover>;
};

const frames = (s: number) => Math.round(s * FPS);
const secs = (f: number) => Math.round((f / FPS) * 100) / 100;

function summary(doc: MotionDoc, selection: string[]) {
  return {
    width: doc.width,
    height: doc.height,
    duration: secs(doc.durationInFrames),
    selected: selection,
    tracks: doc.tracks.map((t) => ({
      id: t.id,
      kind: t.kind,
      clips: t.clips.map((c) => ({
        id: c.id,
        component: c.component,
        start: secs(c.from),
        duration: secs(c.durationInFrames),
        props: c.props,
        in: c.transitionIn.kind,
        out: c.transitionOut.kind
      }))
    }))
  };
}

function componentCatalogue() {
  return COMPONENT_IDS.map((id) => ({
    id,
    track: COMPONENTS[id].track,
    about: COMPONENTS[id].description,
    props: Object.fromEntries(fieldsOf(id).map((f) => [f.key, f.options ? f.options.join('|') : f.min !== undefined ? `${f.min}..${f.max}` : f.control]))
  }));
}

export function createMotionTools(deps: MotionToolDeps): Record<string, Tool> {
  const { session } = deps;

  const apply = (result: OpResult, what: string) => {
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    session.doc = result.doc;
    session.edits.push(what);
    return { ok: true, doc: summary(session.doc, session.selection) };
  };

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
      description: 'The motion library: every component a clip can use, its track and the props it takes (ranges are relative to the frame: x/y/width/height go 0..1).',
      inputSchema: z.object({}).strict(),
      execute: async () => componentCatalogue()
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
        return apply(registered(setProps(session.doc, input.clip_id, input.props), input.props.assetId), `edited ${input.clip_id}`);
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

    add_track: tool({
      description: 'Add a visual or audio track. A new visual track goes on top.',
      inputSchema: z.object({ kind: z.enum([TrackKind.Visual, TrackKind.Audio]) }),
      execute: async (input) => apply(addTrack(session.doc, input.kind, deps.newId()), `added ${input.kind} track`)
    }),

    set_canvas: tool({
      description: 'Change the format (16:9, 9:16, 1:1, 4:5) or the total duration in seconds (max 60).',
      inputSchema: z.object({ format: z.enum(MOTION_FORMATS).optional(), duration: z.number().positive().max(60).optional() }),
      execute: async (input) => apply(setCanvas(session.doc, { format: input.format, durationInFrames: input.duration === undefined ? undefined : frames(input.duration) }), 'changed the canvas')
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

export function selectionNote(doc: MotionDoc, selection: string[]): string {
  const clips = selection.map((id) => findClip(doc, id)?.clip).filter((c) => c !== undefined);
  if (!clips.length) {
    return 'Nothing is selected in the timeline.';
  }
  return `The user has selected: ${clips.map((c) => `${c.component} ${c.id} (${secs(c.from)}s–${secs(c.from + c.durationInFrames)}s)`).join(', ')}. "This", "it" or "the selected layer" mean these clips.`;
}
