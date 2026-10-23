import { clipProps, type MotionClip, type MotionDoc, type MotionTrack } from '$lib/motion/doc';
import { Strictness } from '$lib/motion/custom/component';
import { FillType, ImageFit } from '$lib/motion/fill/model';
import type { FigmaImage } from './figma-doc';

export type ImageAssets = Record<string, string>;
export type FigmaJob = { nodeId: string; fileKey: string; images: FigmaImage[] };

type Slot = { assetId: string; at: number };

function filledClip(doc: MotionDoc, clip: MotionClip, slots: Slot[]): MotionClip {
  const fills = ((clip.props.fills as Record<string, unknown>[] | undefined) ?? []).map((fill, at) => {
    const slot = slots.find((s) => s.at === at);
    return slot ? { type: FillType.Image, assetId: slot.assetId, fit: ImageFit.Cover, opacity: fill.opacity ?? 1 } : fill;
  });
  const verdict = clipProps(doc.components, clip.component, { ...clip.props, fills }, Strictness.Strict);
  return verdict.ok ? { ...clip, props: verdict.props } : clip;
}

const filledTracks = (doc: MotionDoc, tracks: MotionTrack[], slotsOf: Map<string, Slot[]>): MotionTrack[] =>
  tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (slotsOf.has(c.id) ? filledClip(doc, c as MotionClip, slotsOf.get(c.id)!) : c)) }));

export function imagesFilled(doc: MotionDoc, images: readonly FigmaImage[], assets: ImageAssets): MotionDoc {
  const slotsOf = new Map<string, Slot[]>();
  for (const { clipId, hash, at } of images) {
    if (assets[hash]) {
      slotsOf.set(clipId, [...(slotsOf.get(clipId) ?? []), { assetId: assets[hash], at }]);
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
