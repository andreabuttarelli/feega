import { z } from 'zod';
import { Ease } from '../design';
import { TRANSFORM, easeSchema, mixColor } from '../keyframes';

export enum ElementState {
  Default = 'default',
  Hover = 'hover',
  Pressed = 'pressed',
  Focus = 'focus'
}

export const STATE_LABEL: Record<ElementState, string> = {
  [ElementState.Default]: 'Default',
  [ElementState.Hover]: 'Hover',
  [ElementState.Pressed]: 'Pressed',
  [ElementState.Focus]: 'Focus'
};

export const OVERRIDABLE_STATES = [ElementState.Hover, ElementState.Pressed, ElementState.Focus] as const;

type Parts = { transform: Record<string, unknown>; props: Record<string, unknown> };
type Slot = { read: (p: Parts) => unknown; write: (p: Parts, value: unknown) => void };

const transformSlot = (key: keyof typeof TRANSFORM): Slot => ({
  read: (p) => p.transform[key] ?? TRANSFORM[key].fallback,
  write: (p, value) => (p.transform[key] = value)
});

const propSlot = (key: string): Slot => ({ read: (p) => p.props[key], write: (p, value) => (p.props[key] = value) });

type Painted = { color?: unknown };
const firstOf = (p: Parts, list: string) => (Array.isArray(p.props[list]) && p.props[list].length ? (p.props[list] as unknown[]) : null);

const paintSlot = (list: string, flat: string, paintOf: (item: Record<string, unknown>) => Painted, repaint: (item: Record<string, unknown>, color: unknown) => Record<string, unknown>): Slot => ({
  read: (p) => {
    const items = firstOf(p, list);
    return items ? paintOf(items[0] as Record<string, unknown>).color : p.props[flat];
  },
  write: (p, value) => {
    const items = firstOf(p, list);
    if (items) {
      p.props[list] = [repaint(items[0] as Record<string, unknown>, value), ...items.slice(1)];
      return;
    }
    p.props[flat] = value;
  }
});

const fillSlot = paintSlot('fills', 'fill', (f) => f, (f, color) => ({ ...f, color }));
const strokeSlot = paintSlot('strokes', 'stroke', (s) => (s.paint ?? {}) as Painted, (s, color) => ({ ...s, paint: { ...(s.paint as object), color } }));

const colour = z.string().min(1).max(64);
const unit = (key: 'opacity' | 'scale' | 'rotateZ' | 'blur') => z.number().min(TRANSFORM[key].min).max(TRANSFORM[key].max);

export const STATE_OVERRIDES = {
  opacity: { slot: transformSlot('opacity'), schema: unit('opacity') },
  scale: { slot: transformSlot('scale'), schema: unit('scale') },
  rotateZ: { slot: transformSlot('rotateZ'), schema: unit('rotateZ') },
  blur: { slot: transformSlot('blur'), schema: unit('blur') },
  fill: { slot: fillSlot, schema: colour },
  stroke: { slot: strokeSlot, schema: colour },
  strokeWidth: { slot: propSlot('strokeWidth'), schema: z.number().min(0).max(1) },
  cornerRadius: { slot: propSlot('cornerRadius'), schema: z.number().min(0).max(1000) }
} as const;

export type OverrideKey = keyof typeof STATE_OVERRIDES;
export const OVERRIDE_KEYS = Object.keys(STATE_OVERRIDES) as OverrideKey[];

export const DEFAULT_STATE_MS = 200;
export const MAX_STATE_MS = 5000;

const overridesSchema = z
  .object(Object.fromEntries(OVERRIDE_KEYS.map((k) => [k, STATE_OVERRIDES[k].schema.optional()])) as { [K in OverrideKey]: z.ZodOptional<(typeof STATE_OVERRIDES)[K]['schema']> })
  .strict();

export const stateTransitionSchema = z.object({
  easing: easeSchema.default(Ease.Standard),
  durationMs: z.number().int().min(0).max(MAX_STATE_MS).default(DEFAULT_STATE_MS)
});

export const stateRowSchema = z.object({
  state: z.enum(OVERRIDABLE_STATES),
  overrides: overridesSchema,
  transition: stateTransitionSchema.default({ easing: Ease.Standard, durationMs: DEFAULT_STATE_MS })
});

export const statesSchema = z
  .array(stateRowSchema)
  .max(OVERRIDABLE_STATES.length)
  .refine((rows) => new Set(rows.map((r) => r.state)).size === rows.length, 'one row per state');

export type StateRow = z.infer<typeof stateRowSchema>;
export type StateRowInput = z.input<typeof stateRowSchema>;
export type StateOverrides = StateRow['overrides'];

type Stateful = { transform: Record<string, unknown>; props: Record<string, unknown>; states?: StateRow[] };

export const readOverride = (clip: Parts, key: OverrideKey): unknown => STATE_OVERRIDES[key].slot.read(clip);

function mixValue(from: unknown, to: unknown, amount: number): unknown {
  if (typeof from === 'number' && typeof to === 'number') {
    return from + (to - from) * amount;
  }
  if (typeof from === 'string' && typeof to === 'string' && from.startsWith('#') && to.startsWith('#')) {
    return mixColor(from, to, amount);
  }
  return amount < 1 && from !== undefined ? from : to;
}

function applied<C extends Stateful>(clip: C, state: ElementState, amount: number): Pick<C, 'transform' | 'props'> {
  const row = clip.states?.find((r) => r.state === state);
  if (!row || amount <= 0) {
    return { transform: clip.transform, props: clip.props };
  }

  const parts: Parts = { transform: { ...clip.transform }, props: { ...clip.props } };
  for (const [key, value] of Object.entries(row.overrides)) {
    const slot = STATE_OVERRIDES[key as OverrideKey].slot;
    slot.write(parts, amount >= 1 ? value : mixValue(slot.read(clip), value, amount));
  }
  return parts as Pick<C, 'transform' | 'props'>;
}

export const resolveState = <C extends Stateful>(clip: C, state: ElementState): Pick<C, 'transform' | 'props'> => applied(clip, state, 1);

export const mixState = <C extends Stateful>(clip: C, state: ElementState, amount: number): Pick<C, 'transform' | 'props'> => applied(clip, state, amount);
