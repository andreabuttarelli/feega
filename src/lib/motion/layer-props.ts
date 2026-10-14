export enum Flip {
  Horizontal = 'horizontal',
  Vertical = 'vertical'
}

type Scales = { scaleX?: number; scaleY?: number };

const AXIS: Record<Flip, keyof Scales> = {
  [Flip.Horizontal]: 'scaleX',
  [Flip.Vertical]: 'scaleY'
};

export function flipPatch(scales: Scales, flip: Flip): Scales {
  const key = AXIS[flip];
  return { [key]: -(scales[key] ?? 1) };
}
