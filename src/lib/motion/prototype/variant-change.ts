import { clipsOf, compOf, type MotionClip, type MotionDoc, type MotionTrack } from '@feega/motion-core/motion/doc';
import { ActionKind, type Interaction } from '@feega/motion-core/motion/prototype/model';
import { innerClips } from '$lib/motion/main-component';
import { setMembers, variantProps, type Variant } from '$lib/motion/variants';
import type { FrameRect, FrameSize } from './hotspots';

export type Placed = { path: string[]; clip: MotionClip };
export type VariantSpot = { path: string[]; interaction: Interaction };
export type Swap = { instance: string; comp: string };
export type Swaps = Record<string, string>;
export type VariantHotspot = VariantSpot & { box: FrameRect };

const MAX_DEPTH = 32;

const sameVariant = (a: Variant, b: Variant) => Object.keys({ ...a, ...b }).every((k) => a[k] === b[k]);

export function placedClips(doc: MotionDoc): Placed[] {
  const placed: Placed[] = [];
  const walk = (clips: MotionClip[], above: string[]) => {
    for (const clip of clips) {
      const path = [...above, clip.id];
      placed.push({ path, clip });
      const inner = compOf(clip);
      if (inner && doc.comps[inner] && path.length < MAX_DEPTH) {
        walk(innerClips(doc.comps[inner]), path);
      }
    }
  };
  walk(clipsOf(doc), []);
  return placed;
}

export const changesVariant = (interaction: Interaction): boolean => interaction.action.kind === ActionKind.ChangeTo;

export function variantSpotsOf(doc: MotionDoc): VariantSpot[] {
  return placedClips(doc).flatMap(({ path, clip }) => (clip.interactions ?? []).filter(changesVariant).map((interaction) => ({ path, interaction })));
}

export function variantHotspotsOf(doc: MotionDoc, size: FrameSize, rectOf: (path: readonly string[]) => FrameRect | null): VariantHotspot[] {
  return variantSpotsOf(doc).flatMap((spot) => {
    const rect = rectOf(spot.path);
    return rect ? [{ ...spot, box: { left: rect.left / size.width, top: rect.top / size.height, width: rect.width / size.width, height: rect.height / size.height } }] : [];
  });
}

function clipById(doc: MotionDoc, id: string): MotionClip | null {
  return placedClips(doc).find((p) => p.clip.id === id)?.clip ?? null;
}

export function changeTo(doc: MotionDoc, path: readonly string[], picked: Variant): Swap | null {
  for (const id of [...path].reverse()) {
    const clip = clipById(doc, id);
    const comp = clip ? compOf(clip) : null;
    const main = comp ? doc.comps[comp]?.component : undefined;
    if (!comp || !main) {
      continue;
    }
    const wanted = { ...main.variant, ...picked };
    const match = setMembers(doc, comp).find(([, c]) => sameVariant(c.component!.variant ?? {}, wanted));
    if (!match) {
      continue;
    }
    return match[0] === comp ? null : { instance: id, comp: match[0] };
  }
  return null;
}

const swappedTracks = (tracks: MotionTrack[], swaps: Swaps): MotionTrack[] =>
  tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (swaps[c.id] && compOf(c) ? { ...c, props: { ...c.props, comp: swaps[c.id] } } : c)) }));

export function withSwaps(doc: MotionDoc, swaps: Swaps): MotionDoc {
  if (!Object.keys(swaps).length) {
    return doc;
  }
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: swappedTracks(comp.tracks, swaps) }]));
  return { ...doc, tracks: swappedTracks(doc.tracks, swaps), comps };
}

export function variantChoices(doc: MotionDoc, clipId: string): Variant[] {
  const path = placedClips(doc).find((p) => p.clip.id === clipId)?.path ?? [];
  for (const id of [...path].reverse()) {
    const comp = compOf(clipById(doc, id)!);
    if (comp && doc.comps[comp]?.component) {
      return Object.entries(variantProps(doc, comp)).flatMap(([prop, values]) => values.map((value) => ({ [prop]: value })));
    }
  }
  return [];
}
