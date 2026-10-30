import { OverrideTarget, STATE_OVERRIDES, type OverrideKey } from '@feega/motion-core/motion/states/model';

export enum FieldKind {
  Number = 'number',
  Colour = 'colour'
}

type Field = { label: string; kind: FieldKind; fallback: number | string };

export const OVERRIDE_FIELD: Record<OverrideKey, Field> = {
  opacity: { label: 'Opacity', kind: FieldKind.Number, fallback: 1 },
  scale: { label: 'Scale', kind: FieldKind.Number, fallback: 1 },
  rotateZ: { label: 'Rotation', kind: FieldKind.Number, fallback: 0 },
  blur: { label: 'Blur', kind: FieldKind.Number, fallback: 0 },
  fill: { label: 'Fill', kind: FieldKind.Colour, fallback: '#ffffff' },
  stroke: { label: 'Stroke', kind: FieldKind.Colour, fallback: '#000000' },
  strokeWidth: { label: 'Stroke width', kind: FieldKind.Number, fallback: 0.01 },
  cornerRadius: { label: 'Corner radius', kind: FieldKind.Number, fallback: 8 }
};

type Drawn = { transform: Record<string, unknown>; props: Record<string, unknown> };

export function seedOf(clip: Drawn, key: OverrideKey): number | string {
  const source = STATE_OVERRIDES[key].target === OverrideTarget.Transform ? clip.transform : clip.props;
  const own = source[key];
  const kind = OVERRIDE_FIELD[key].kind;
  const fits = kind === FieldKind.Colour ? typeof own === 'string' && own.startsWith('#') : typeof own === 'number';
  return fits ? (own as number | string) : OVERRIDE_FIELD[key].fallback;
}
