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

export enum OverrideTarget {
  Transform = 'transform',
  Props = 'props'
}

const colour = z.string().min(1).max(64);
const unit = (key: 'opacity' | 'scale' | 'rotateZ' | 'blur') => z.number().min(TRANSFORM[key].min).max(TRANSFORM[key].max);

export const STATE_OVERRIDES = {
  opacity: { target: OverrideTarget.Transform, schema: unit('opacity') },
  scale: { target: OverrideTarget.Transform, schema: unit('scale') },
  rotateZ: { target: OverrideTarget.Transform, schema: unit('rotateZ') },
  blur: { target: OverrideTarget.Transform, schema: unit('blur') },
  fill: { target: OverrideTarget.Props, schema: colour },
  stroke: { target: OverrideTarget.Props, schema: colour },
  strokeWidth: { target: OverrideTarget.Props, schema: z.number().min(0).max(1) },
  cornerRadius: { target: OverrideTarget.Props, schema: z.number().min(0).max(1000) }
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

export function resolveState<C extends Stateful>(clip: C, state: ElementState): Pick<C, 'transform' | 'props'> {
  const row = clip.states?.find((r) => r.state === state);
  if (!row) {
    return { transform: clip.transform, props: clip.props };
  }

  const transform = { ...clip.transform };
  const props = { ...clip.props };
  const targets = { [OverrideTarget.Transform]: transform, [OverrideTarget.Props]: props };
  for (const [key, value] of Object.entries(row.overrides)) {
    targets[STATE_OVERRIDES[key as OverrideKey].target][key] = value;
  }
  return { transform, props } as Pick<C, 'transform' | 'props'>;
}

const baseOf = (clip: Stateful, key: OverrideKey): unknown => {
  const target = STATE_OVERRIDES[key].target;
  const own = target === OverrideTarget.Transform ? clip.transform[key] : clip.props[key];
  return own ?? (key in TRANSFORM ? TRANSFORM[key as keyof typeof TRANSFORM].fallback : undefined);
};

function mixValue(from: unknown, to: unknown, amount: number): unknown {
  if (typeof from === 'number' && typeof to === 'number') {
    return from + (to - from) * amount;
  }
  if (typeof from === 'string' && typeof to === 'string' && from.startsWith('#') && to.startsWith('#')) {
    return mixColor(from, to, amount);
  }
  return amount < 1 && from !== undefined ? from : to;
}

export function mixState<C extends Stateful>(clip: C, state: ElementState, amount: number): Pick<C, 'transform' | 'props'> {
  if (amount <= 0) {
    return resolveState(clip, ElementState.Default);
  }
  if (amount >= 1) {
    return resolveState(clip, state);
  }

  const row = clip.states?.find((r) => r.state === state);
  const transform = { ...clip.transform };
  const props = { ...clip.props };
  const targets = { [OverrideTarget.Transform]: transform, [OverrideTarget.Props]: props };
  for (const [key, value] of Object.entries(row?.overrides ?? {})) {
    const k = key as OverrideKey;
    targets[STATE_OVERRIDES[k].target][k] = mixValue(baseOf(clip, k), value, amount);
  }
  return { transform, props } as Pick<C, 'transform' | 'props'>;
}
