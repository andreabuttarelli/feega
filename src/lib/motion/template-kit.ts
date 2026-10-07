import { TrackKind, type ComponentId } from './components';
import { Ease, FPS, TransitionKind, type Edge } from './design';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import type { EaseSpec, KeyValue, Transform } from './keyframes';
import type { MaskInput } from './mask';
import type { FontFace } from './fonts/model';
import { addClip } from './timeline';

export const s = (seconds: number) => Math.round(seconds * FPS);

export type Key = [seconds: number, value: KeyValue, ease?: EaseSpec];

export type Beat = {
  id: string;
  track: string;
  component: ComponentId;
  at: number;
  len: number;
  props?: Record<string, unknown>;
  enter?: Edge;
  exit?: Edge;
  keys?: Record<string, Key[]>;
  mask?: MaskInput;
  transform?: Transform;
};

export type TrackSpec = { id: string; kind: TrackKind; name: string };

export const edge = (kind: TransitionKind, seconds: number): Edge => ({ kind, durationInFrames: s(seconds) });
export const FADE_OUT = edge(TransitionKind.Fade, 0.25);
export const RISE = edge(TransitionKind.SlideUp, 0.35);

function keyframesOf(keys: Record<string, Key[]> = {}) {
  return Object.fromEntries(Object.entries(keys).map(([prop, track]) => [prop, track.map(([at, value, ease]) => ({ frame: s(at), value, ease: ease ?? Ease.Standard }))]));
}

export function assemble(input: { format: MotionFormat; seconds: number; tracks: TrackSpec[]; beats: (Beat | null)[]; fonts?: FontFace[] }): MotionDoc {
  let doc: MotionDoc = { ...newMotionDoc(input.format), durationInFrames: s(input.seconds), tracks: input.tracks.map((t) => ({ ...t, clips: [] })), fonts: input.fonts ?? [] };

  for (const beat of input.beats) {
    if (!beat) {
      continue;
    }
    const added = addClip(doc, { component: beat.component, trackId: beat.track, from: s(beat.at), durationInFrames: s(beat.at + beat.len) - s(beat.at), props: beat.props, transitionIn: beat.enter, transitionOut: beat.exit }, beat.id);
    if (!added.ok) {
      throw new Error(`${beat.id}: ${added.error}`);
    }
    doc = {
      ...added.doc,
      tracks: added.doc.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === beat.id ? { ...c, keyframes: keyframesOf(beat.keys), mask: (beat.mask ?? null) as never, transform: beat.transform ?? {} } : c))
      }))
    };
  }

  const verdict = parseMotionDoc(doc);
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}
