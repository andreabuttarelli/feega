import { parseMotionDoc, type MotionClip, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';

type Loose = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const defaults = new Map<string, Loose>();

function defaultClip(doc: MotionDoc, component: string): Loose {
  const known = defaults.get(component);
  if (known) {
    return known;
  }
  const bare = { ...doc, comps: {}, fields: [], tracks: [{ id: 't', kind: 'visual', clips: [{ id: 'c', from: 0, durationInFrames: 1, component, props: {} }] }] };
  const parsed = parseMotionDoc(bare);
  const clip = parsed.ok ? (parsed.doc.tracks[0].clips[0] as unknown as Loose) : {};
  defaults.set(component, clip);
  return clip;
}

const without = (value: Loose, base: Loose) => Object.fromEntries(Object.entries(value).filter(([key, v]) => !(key in base) || !same(v, base[key])));

function compactClip(doc: MotionDoc, clip: MotionClip): MotionClip {
  const base = defaultClip(doc, clip.component);
  const kept = without(clip as unknown as Loose, { ...base, id: undefined, from: undefined, durationInFrames: undefined, component: undefined, props: undefined });
  return { ...kept, id: clip.id, from: clip.from, durationInFrames: clip.durationInFrames, component: clip.component, props: without(clip.props as Loose, (base.props ?? {}) as Loose) } as unknown as MotionClip;
}

const compactTracks = (doc: MotionDoc, tracks: MotionTrack[]) => tracks.map((t) => ({ ...t, clips: t.clips.map((c) => compactClip(doc, c as MotionClip)) }));

export function compacted(doc: MotionDoc): MotionDoc {
  return { ...doc, tracks: compactTracks(doc, doc.tracks), comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: compactTracks(doc, comp.tracks) }])) };
}
