export enum CardKind {
  Image = 'image',
  Video = 'video',
  Comp = 'comp'
}

export enum Spin {
  Left = 'left',
  Right = 'right'
}

export const CARD_KINDS = Object.values(CardKind) as [CardKind, ...CardKind[]];
export const SPINS = Object.values(Spin) as [Spin, ...Spin[]];

export const SLICES_PER_CARD = 6;
export const MAX_RING_CARDS = 24;

export enum RingSection {
  Shape = 'shape',
  Motion = 'motion',
  Look = 'look',
  Camera = 'camera'
}

export type RingNumber = { label: string; min: number; max: number; step: number; fallback: number; section: RingSection };

const n = (label: string, min: number, max: number, step: number, fallback: number, section: RingSection): RingNumber => ({ label, min, max, step, fallback, section });

export const RING_NUMBERS = {
  ringRadius: n('Radius', 0.1, 2, 0.01, 0.6, RingSection.Shape),
  cardHeight: n('Card height', 0.05, 1.5, 0.01, 0.34, RingSection.Shape),
  gap: n('Gap', 0, 0.2, 0.001, 0.025, RingSection.Shape),
  tiltX: n('Tilt X', -90, 90, 1, -14, RingSection.Shape),
  tiltZ: n('Tilt Z', -90, 90, 1, -12, RingSection.Shape),
  spin: n('Spin offset', -360, 360, 1, 0, RingSection.Motion),
  backOpacity: n('Back opacity', 0, 1, 0.01, 0.55, RingSection.Look),
  backBlur: n('Back blur', 0, 40, 0.5, 1.5, RingSection.Look),
  shadowOpacity: n('Shadow', 0, 1, 0.01, 0.3, RingSection.Look),
  cameraDistance: n('Perspective', 200, 6000, 10, 1500, RingSection.Camera),
  cameraHeight: n('Camera height', -1, 1, 0.01, 0.1, RingSection.Camera)
} as const satisfies Record<string, RingNumber>;

export type RingNumberKey = keyof typeof RING_NUMBERS;
export const RING_NUMBER_KEYS = Object.keys(RING_NUMBERS) as RingNumberKey[];

export type RingCard = { kind: CardKind; ref: string };

export function cardAt(cards: readonly RingCard[], index: number): RingCard | null {
  return cards.length ? cards[index % cards.length] : null;
}

export function ringSliceId(ringId: string, card: number, slice: number): string {
  return `${ringId}__r${card}s${slice}`;
}
