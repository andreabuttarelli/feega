import { z } from 'zod';

export const MAX_FRAG_BYTES = 12288;
export const MAX_PARAMS = 12;

const KEY = /^[a-z][a-z0-9_]*$/i;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-f]{6}$/i;

export const RESERVED_KEYS = ['src', 'res', 'time', 'seed'];

const base = {
  key: z
    .string()
    .regex(KEY)
    .max(32)
    .refine((k) => !RESERVED_KEYS.includes(k), 'key clashes with a contract uniform (src, res, time, seed)'),
  label: z.string().min(1).max(40)
};

const numberParam = z
  .object({ ...base, kind: z.literal('number'), min: z.number(), max: z.number(), step: z.number().positive(), default: z.number() })
  .refine((p) => p.min < p.max, 'min must be below max')
  .refine((p) => p.default >= p.min && p.default <= p.max, 'default must be within min..max');

const colorParam = z.object({ ...base, kind: z.literal('color'), default: z.string().regex(HEX) });

const seedParam = z.object({ ...base, kind: z.literal('seed'), default: z.number() });

export const shaderParam = z.union([numberParam, colorParam, seedParam]);

export type ShaderParam = z.infer<typeof shaderParam>;

export const effectInput = z.object({
  name: z.string().regex(NAME).max(48),
  frag: z.string().min(1).max(MAX_FRAG_BYTES),
  params: z
    .array(shaderParam)
    .max(MAX_PARAMS)
    .refine((ps) => new Set(ps.map((p) => p.key)).size === ps.length, 'param keys must be unique')
});

export type EffectInput = z.infer<typeof effectInput>;

export type Parsed = { ok: true; effect: EffectInput } | { ok: false; problems: string[] };

export function parseEffect(input: unknown): Parsed {
  const result = effectInput.safeParse(input);
  if (result.success) {
    return { ok: true, effect: result.data };
  }

  return { ok: false, problems: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
