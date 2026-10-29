import { clipProps, type MotionClip, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { Strictness } from '@feega/motion-core/motion/custom/component';
import { FillType, ImageFit } from '@feega/motion-core/motion/fill/model';
import type { FigmaImage } from './figma-doc';

export type ImageAssets = Record<string, string>;
export type FigmaJob = { nodeId: string; fileKey: string; images: FigmaImage[] };

type Slot = { assetId: string; at: number; innerId?: string };

type Overrides = Record<string, Record<string, unknown>>;

const filledFills = (fills: unknown, slots: Slot[]) =>
  ((fills as Record<string, unknown>[] | undefined) ?? []).map((fill, at) => {
    const slot = slots.find((s) => s.at === at);
    return slot ? { type: FillType.Image, assetId: slot.assetId, fit: ImageFit.Cover, opacity: fill.opacity ?? 1 } : fill;
  });

function filledInstance(doc: MotionDoc, clip: MotionClip, slots: Slot[]): MotionClip {
  const main = doc.comps[String(clip.props.comp)];
  const overrides = { ...(clip.props.overrides as Overrides | undefined) };
  for (const [innerId, own] of Map.groupBy(slots, (s) => s.innerId!)) {
    const inner = main?.tracks.flatMap((t) => t.clips).find((c) => c.id === innerId);
    overrides[innerId] = { ...overrides[innerId], fills: filledFills(overrides[innerId]?.fills ?? inner?.props.fills, own) };
  }
  return { ...clip, props: { ...clip.props, overrides } };
}

function filledClip(doc: MotionDoc, clip: MotionClip, slots: Slot[]): MotionClip {
  if (slots.some((s) => s.innerId)) {
    return filledInstance(doc, clip, slots);
  }
  const fills = filledFills(clip.props.fills, slots);
  const verdict = clipProps(doc.components, clip.component, { ...clip.props, fills }, Strictness.Strict);
  return verdict.ok ? { ...clip, props: verdict.props } : clip;
}

const filledTracks = (doc: MotionDoc, tracks: MotionTrack[], slotsOf: Map<string, Slot[]>): MotionTrack[] =>
  tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (slotsOf.has(c.id) ? filledClip(doc, c as MotionClip, slotsOf.get(c.id)!) : c)) }));

export function imagesFilled(doc: MotionDoc, images: readonly FigmaImage[], assets: ImageAssets): MotionDoc {
  const slotsOf = new Map<string, Slot[]>();
  for (const { clipId, hash, at, innerId } of images) {
    if (assets[hash]) {
      slotsOf.set(clipId, [...(slotsOf.get(clipId) ?? []), { assetId: assets[hash], at, innerId }]);
    }
  }
  if (!slotsOf.size) {
    return doc;
  }
  return {
    ...doc,
    tracks: filledTracks(doc, doc.tracks, slotsOf),
    comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: filledTracks(doc, comp.tracks, slotsOf) }]))
  };
}
