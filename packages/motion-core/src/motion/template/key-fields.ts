import { z } from 'zod';
import { FIELD_KEY, FieldType } from './field-model';

export const KEY_FIELDS_MAX = 5;
const GUESSED_KEY_FIELDS = 3;

const EVERYDAY_TYPES: ReadonlySet<FieldType> = new Set([FieldType.Text, FieldType.Color, FieldType.Asset, FieldType.MediaList]);

export const keyFieldsSchema = z
  .array(z.string().regex(FIELD_KEY))
  .max(KEY_FIELDS_MAX)
  .optional()
  .describe(
    'The few field keys a non-technical user edits first (the text, the colours, the photos), in display order. The library detail and the Properties panel show them on top; every other field goes under a collapsed Advanced section. Left out, the first everyday fields (text, colour, media) are shown instead.'
  );

export type KeyFields = z.infer<typeof keyFieldsSchema>;

export enum FieldLayout {
  Grouped = 'grouped',
  Flat = 'flat'
}

type Keyed = { key: string; type: FieldType };
export type SplitFields<T> = { key: T[]; advanced: T[] };

function guessed<T extends Keyed>(fields: readonly T[]): string[] {
  return fields.filter((f) => EVERYDAY_TYPES.has(f.type)).slice(0, GUESSED_KEY_FIELDS).map((f) => f.key);
}

export function splitFields<T extends Keyed>(fields: readonly T[], declared: KeyFields): SplitFields<T> {
  const keys = declared ?? guessed(fields);
  const key = keys.flatMap((k) => fields.filter((f) => f.key === k));
  const picked = new Set(key);
  return { key, advanced: fields.filter((f) => !picked.has(f)) };
}
