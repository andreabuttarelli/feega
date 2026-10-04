import { CAMERA_PRESETS, type CameraPresetId } from '../canvas/composition/camera';
import { LAYOUTS } from '../canvas/composition/index';
import type { LayoutId, LayoutParams } from '../canvas/composition/types';
import type { CompositionAspect, CompositionNode } from '../canvas/composition-node';
import { TrackKind, defaultProps } from './components';
import { FORMATS, MotionFormat, formatOf, newClip, parseMotionDoc, type DocVerdict, type MotionClip, type MotionDoc, type MotionTrack } from './doc';
import type { PropsOf } from './hyperframes/templates';

export type ComposeMedia = PropsOf<'Composition'>['media'][number];

export type ComposeDraft = {
  layout: LayoutId;
  layoutParams: LayoutParams;
  camera: CameraPresetId;
  cameraParams: LayoutParams;
  background: string;
  seconds: number;
  format: MotionFormat;
  media: ComposeMedia[];
  headline: string;
  headlineColor: string;
  logo: boolean;
};

export const COMPOSITION_CLIP = 'composition';
export const HEADLINE_CLIP = 'headline';
export const LOGO_CLIP = 'logo';
const OVERLAY_TRACK = { id: 'compose-text', name: 'Text' };

export const MIN_SECONDS = 0.5;
export const MAX_COMPOSE_SECONDS = 60;
const DEFAULT_SECONDS = 6;
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_HEADLINE_COLOR = 'brand.text';
const MOVING_CAMERA: CameraPresetId = 'slow-orbit';
const STILL_CAMERA: CameraPresetId = 'static';

const FORMAT_OF_ASPECT: Record<CompositionAspect, MotionFormat> = {
  '9:16': MotionFormat.Vertical,
  '1:1': MotionFormat.Square,
  '16:9': MotionFormat.Landscape
};

const defaultsOf = (defs: readonly { name: string; default: number | string }[]): LayoutParams => Object.fromEntries(defs.map((d) => [d.name, d.default]));

export function withLayout(draft: ComposeDraft, layout: LayoutId): ComposeDraft {
  const camera = LAYOUTS[layout].camera === 'fixed' ? STILL_CAMERA : draft.camera;
  const cameraParams = camera === draft.camera ? draft.cameraParams : defaultsOf(CAMERA_PRESETS[camera].params);
  return { ...draft, layout, layoutParams: defaultsOf(LAYOUTS[layout].params), camera, cameraParams };
}

export function withCamera(draft: ComposeDraft, camera: CameraPresetId): ComposeDraft {
  return { ...draft, camera, cameraParams: defaultsOf(CAMERA_PRESETS[camera].params) };
}

export function newDraft(layout: LayoutId): ComposeDraft {
  const base: ComposeDraft = {
    layout,
    layoutParams: {},
    camera: MOVING_CAMERA,
    cameraParams: defaultsOf(CAMERA_PRESETS[MOVING_CAMERA].params),
    background: DEFAULT_BACKGROUND,
    seconds: DEFAULT_SECONDS,
    format: FORMAT_OF_ASPECT['9:16'],
    media: [],
    headline: '',
    headlineColor: DEFAULT_HEADLINE_COLOR,
    logo: false
  };
  return withLayout(base, layout);
}

export function clampSeconds(seconds: number): number {
  return Math.min(MAX_COMPOSE_SECONDS, Math.max(MIN_SECONDS, seconds));
}

export function draftFromNode(node: CompositionNode, media: ComposeMedia[]): ComposeDraft {
  return {
    ...newDraft(node.layout),
    layoutParams: node.layoutParams,
    camera: node.camera.preset,
    cameraParams: node.camera.params,
    background: node.background.color,
    seconds: clampSeconds(node.duration),
    format: FORMAT_OF_ASPECT[node.aspect],
    media
  };
}

function clipOf(id: string, component: MotionClip['component'], frames: number, props: Record<string, unknown>): MotionClip {
  return newClip({ id, from: 0, durationInFrames: frames, component, props: { ...defaultProps(component), ...props } });
}

function upsert(track: MotionTrack, clip: MotionClip | null, id: string): MotionTrack {
  const at = track.clips.findIndex((c) => c.id === id);
  const kept = track.clips.filter((c) => c.id !== id);
  if (!clip) {
    return { ...track, clips: kept };
  }
  const existing = at >= 0 ? (track.clips[at] as MotionClip) : null;
  const merged = existing ? { ...existing, from: 0, durationInFrames: clip.durationInFrames, props: { ...existing.props, ...clip.props } } : clip;
  return { ...track, clips: at >= 0 ? track.clips.map((c, i) => (i === at ? merged : c)) : [...kept, merged] };
}

function trackHolding(doc: MotionDoc, clipId: string): number {
  return doc.tracks.findIndex((t) => t.clips.some((c) => c.id === clipId));
}

function compositionTrack(doc: MotionDoc): number {
  const holding = trackHolding(doc, COMPOSITION_CLIP);
  if (holding >= 0) {
    return holding;
  }
  return doc.tracks.findLastIndex((t) => t.kind === TrackKind.Visual);
}

function withOverlayTrack(doc: MotionDoc): MotionDoc {
  if (doc.tracks.some((t) => t.id === OVERLAY_TRACK.id)) {
    return doc;
  }
  return { ...doc, tracks: [{ id: OVERLAY_TRACK.id, kind: TrackKind.Visual, name: OVERLAY_TRACK.name, clips: [] }, ...doc.tracks] };
}

export function applyDraft(base: MotionDoc, draft: ComposeDraft): DocVerdict {
  const frames = Math.round(clampSeconds(draft.seconds) * base.fps);
  const { width, height } = FORMATS[draft.format];
  let doc: MotionDoc = withOverlayTrack({ ...structuredClone(base), width, height, durationInFrames: frames });

  const composition = clipOf(COMPOSITION_CLIP, 'Composition', frames, {
    layout: draft.layout,
    media: draft.media,
    layoutParams: draft.layoutParams,
    camera: draft.camera,
    cameraParams: draft.cameraParams,
    background: draft.background,
    loop: clampSeconds(draft.seconds)
  });
  const headline = draft.headline.trim() ? clipOf(HEADLINE_CLIP, 'Title', frames, { text: draft.headline, color: draft.headlineColor }) : null;
  const logo = draft.logo ? clipOf(LOGO_CLIP, 'Logo', frames, { y: 0.88, width: 0.18, height: 0.08 }) : null;

  const target = compositionTrack(doc);
  const overlay = doc.tracks.findIndex((t) => t.id === OVERLAY_TRACK.id);
  doc = {
    ...doc,
    tracks: doc.tracks.map((track, i) => {
      const placed = i === target ? upsert(track, composition, COMPOSITION_CLIP) : track;
      return i === overlay ? upsert(upsert(placed, headline, HEADLINE_CLIP), logo, LOGO_CLIP) : placed;
    })
  };
  return parseMotionDoc(doc);
}

export function draftFromDoc(doc: MotionDoc): ComposeDraft | null {
  const clips = doc.tracks.flatMap((t) => t.clips as MotionClip[]);
  const composition = clips.find((c) => c.id === COMPOSITION_CLIP && c.component === 'Composition');
  if (!composition) {
    return null;
  }
  const p = composition.props as PropsOf<'Composition'>;
  const headline = clips.find((c) => c.id === HEADLINE_CLIP)?.props as PropsOf<'Title'> | undefined;

  return {
    layout: p.layout,
    layoutParams: p.layoutParams,
    camera: p.camera,
    cameraParams: p.cameraParams,
    background: p.background,
    seconds: doc.durationInFrames / doc.fps,
    format: formatOf(doc),
    media: p.media,
    headline: headline?.text ?? '',
    headlineColor: headline?.color ?? DEFAULT_HEADLINE_COLOR,
    logo: clips.some((c) => c.id === LOGO_CLIP)
  };
}

export function composeEditorPath(input: { projectId: string; nodeId: string }): string {
  return `/app/compose/${input.nodeId}?project=${input.projectId}`;
}
