import { RING_COUNT, RING_NUMBERS } from '../../canvas/composition/ring';

export { RING_NUMBERS, RING_NUMBER_KEYS, Spin, SPIN_SIGN, type RingNumberKey } from '../../canvas/composition/ring';

export const RING_LAYOUT = 'ring';

const FACET_TOLERANCE_PX = 1.5;
const MAX_SLICES = 16;

export function slicesFor(count: number, radiusPx: number): number {
  const facet = 2 * Math.acos(Math.max(-1, 1 - FACET_TOLERANCE_PX / Math.max(radiusPx, FACET_TOLERANCE_PX)));
  return Math.min(MAX_SLICES, Math.max(1, Math.ceil((Math.PI * 2) / count / facet)));
}

export function ringRadiusPx(props: RingProps, unit: number): number {
  return Number(props.layoutParams.ringRadius ?? RING_NUMBERS.ringRadius.fallback) * unit;
}

export function ringSliceId(ringId: string, card: number, slice: number): string {
  return `${ringId}__r${card}s${slice}`;
}

export type RingCard = { assetId: string; kind: 'image' | 'video' | 'comp' };
type RingProps = { layout: string; media: readonly RingCard[]; layoutParams: Record<string, number | string> };

export function isRing(props: Record<string, unknown>): boolean {
  return props.layout === RING_LAYOUT;
}

export function ringCount(props: RingProps): number {
  const count = Math.round(Number(props.layoutParams.count ?? RING_COUNT.fallback));
  return Number.isFinite(count) ? Math.min(RING_COUNT.max, Math.max(RING_COUNT.min, count)) : RING_COUNT.fallback;
}

export function ringCards(props: RingProps): (RingCard | null)[] {
  return Array.from({ length: ringCount(props) }, (_, i) => (props.media.length ? props.media[i % props.media.length] : null));
}
