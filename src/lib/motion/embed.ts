import { TrackKind } from './components';
import type { MotionClip, MotionComp, MotionDoc, MotionTrack } from './doc';
import { COMP_CARD, COMP_CARD_LAYOUTS } from './card-layouts';

const SCOPE = '.';

type Rename = (id: string) => string;
type Card = { assetId: string; kind: string };

const RENAMES: Partial<Record<MotionClip['component'], (props: Record<string, unknown>, rename: Rename) => Record<string, unknown>>> = {
  Precomp: (props, rename) => ({ ...props, comp: rename(String(props.comp)) }),
  Composition: (props, rename) =>
    COMP_CARD_LAYOUTS.has(props.layout) ? { ...props, media: ((props.media ?? []) as Card[]).map((m) => (m.kind === COMP_CARD ? { ...m, assetId: rename(m.assetId) } : m)) } : props
};

export function motionCompId(nodeId: string): string {
  return `m${nodeId.replace(/-/g, '')}`;
}

function scopedTracks(tracks: readonly MotionTrack[], rename: Rename): MotionTrack[] {
  return tracks
    .filter((t) => t.kind === TrackKind.Visual)
    .map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (RENAMES[c.component] ? { ...c, props: RENAMES[c.component]!(c.props, rename) } : c)) }));
}

const unionBy = <T>(key: (item: T) => string, ...lists: T[][]): T[] => [...new Map(lists.flat().map((item) => [key(item), item])).values()];

export function embedMotion(host: MotionDoc, nodeId: string, source: MotionDoc): MotionDoc {
  const id = motionCompId(nodeId);
  const rename: Rename = (inner) => `${id}${SCOPE}${inner}`;
  const frame = { width: source.width, height: source.height };
  const nested = Object.fromEntries(Object.entries(source.comps).map(([key, comp]): [string, MotionComp] => [rename(key), { ...comp, frame, tracks: scopedTracks(comp.tracks, rename) }]));
  const outer: MotionComp = { name: id, durationInFrames: source.durationInFrames, frame, background: source.background, tracks: scopedTracks(source.tracks, rename) };

  return {
    ...host,
    comps: { ...host.comps, ...nested, [id]: outer },
    assets: unionBy((a) => a.id, host.assets, source.assets),
    fonts: unionBy((f) => f.family, host.fonts, source.fonts),
    components: { ...source.components, ...host.components }
  };
}
