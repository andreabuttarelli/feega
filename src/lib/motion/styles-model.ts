import { z } from 'zod';
import { TYPE, TYPE_SIZE } from './components';

export enum StyleKind {
  Text = 'text',
  Colour = 'colour'
}

export const MAX_STYLES = 40;
export const STYLE_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;

const colour = z.string().min(1).max(64);

export const textStyleSchema = z
  .object({
    kind: z.literal(StyleKind.Text),
    font: z.string().min(1).max(64).optional(),
    size: z.number().min(TYPE_SIZE.min).max(TYPE_SIZE.max).optional(),
    weight: z.number().int().min(TYPE.weight.min).max(TYPE.weight.max).optional(),
    tracking: z.number().min(TYPE.tracking.min).max(TYPE.tracking.max).optional(),
    leading: z.number().min(TYPE.leading.min).max(TYPE.leading.max).optional(),
    color: colour.optional()
  })
  .strict();

export const colourStyleSchema = z.object({ kind: z.literal(StyleKind.Colour), color: colour }).strict();

export const styleSchema = z.discriminatedUnion('kind', [textStyleSchema, colourStyleSchema]);
export type Style = z.infer<typeof styleSchema>;

export const stylesSchema = z
  .record(z.string().regex(STYLE_NAME, 'style names are letters, digits, spaces, - or _'), styleSchema)
  .refine((s) => Object.keys(s).length <= MAX_STYLES, `at most ${MAX_STYLES} styles`)
  .optional();
