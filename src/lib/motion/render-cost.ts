import type { ComponentId } from './components';
import { clipsOf, type MotionClip, type MotionDoc } from './doc';
import { Matte } from './mask';
import { ringCards, ringRadiusPx, slicesFor, RING_LAYOUT, type RingCard } from './ring/model';

export type CostSpan = { from: number; to: number; ms: number };

export enum Weigh {
  Everything = 'everything',
  EffectsOnly = 'effects-only'
}

export const FLAT_FRAME_MS = 60;
const FULL_HD_PIXELS = 1920 * 1080;
const EFFECT_MS = 100;
const MATTE_MS = 150;
const CARD_COPY_MS = 70;
const MAX_NESTING = 8;

const FRAME_MS: Partial<Record<ComponentId, number>> = {
  Device3D: 1600,
  Logo3D: 400,
  Text3D: 400,
  Model3D: 600,
  Shape3D: 300
};

type Scope = { doc: MotionDoc; depth: number; weigh: Weigh };

function compMs(compId: string, scope: Scope): number {
  const comp = scope.doc.comps[compId];
  if (!comp || scope.depth >= MAX_NESTING) {
    return 0;
  }
  const inner = { ...scope, depth: scope.depth + 1 };
  return comp.tracks.flatMap((t) => t.clips as MotionClip[]).reduce((sum, clip) => sum + clipMs(clip, inner), 0);
}

function cardMs(card: RingCard | null, scope: Scope): number {
  return CARD_COPY_MS + (card?.kind === 'comp' ? compMs(card.assetId, scope) : 0);
}

function cardsMs(clip: MotionClip, scope: Scope): number {
  const props = clip.props as Parameters<typeof ringCards>[0];
  if (!Array.isArray(props.media)) {
    return 0;
  }
  const cards = ringCards(props);
  const copies = props.layout === RING_LAYOUT ? slicesFor(cards.length, ringRadiusPx(props, Math.min(scope.doc.width, scope.doc.height))) : 1;
  return copies * cards.reduce((sum, card) => sum + cardMs(card, scope), 0);
}

const NESTED: Partial<Record<ComponentId, (clip: MotionClip, scope: Scope) => number>> = {
  Precomp: (clip, scope) => compMs(String(clip.props.comp ?? ''), scope),
  Composition: cardsMs
};

function clipMs(clip: MotionClip, scope: Scope): number {
  const own = scope.weigh === Weigh.Everything ? (FRAME_MS[clip.component] ?? 0) : 0;
  const effects = (clip.effects ?? []).filter((e) => e.enabled).length * EFFECT_MS;
  const matte = clip.matte && clip.matte !== Matte.None ? MATTE_MS : 0;
  return own + effects + matte + (NESTED[clip.component]?.(clip, scope) ?? 0);
}

export function costSpans(doc: MotionDoc, pixels = FULL_HD_PIXELS, weigh = Weigh.Everything): CostSpan[] {
  const scope = { doc, depth: 0, weigh };
  return clipsOf(doc).flatMap((clip) => {
    const ms = clipMs(clip, scope);
    return ms ? [{ from: clip.from, to: clip.from + clip.durationInFrames, ms: (ms * pixels) / FULL_HD_PIXELS }] : [];
  });
}

export function frameCosts(totalFrames: number, spans: readonly CostSpan[]): number[] {
  const costs = Array.from({ length: totalFrames }, () => FLAT_FRAME_MS);
  for (const span of spans) {
    for (let f = Math.max(0, span.from); f < Math.min(totalFrames, span.to); f++) {
      costs[f] += span.ms;
    }
  }
  return costs;
}
