import { z } from 'zod';

export enum VarType {
  Colour = 'colour',
  Number = 'number',
  String = 'string',
  Boolean = 'boolean'
}

export const MAX_COLLECTIONS = 8;
export const MAX_MODES = 8;
export const MAX_VARIABLES = 64;
export const MAX_VAR_TEXT = 500;
export const VARIABLE_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;
export const DEFAULT_MODE = 'Default';
export const KEY_SEPARATOR = '/';

const name = z.string().regex(VARIABLE_NAME, 'names are letters, digits, spaces, - or _');
const literal = z.union([z.string().max(MAX_VAR_TEXT), z.number().finite(), z.boolean()]);
const alias = z.object({ alias: z.string().min(3).max(81) }).strict();

export const variableSchema = z.object({ type: z.enum(VarType), values: z.record(name, z.union([literal, alias])) }).strict();

export const collectionSchema = z
  .object({
    modes: z.array(name).min(1).max(MAX_MODES),
    active: name.optional(),
    vars: z.record(name, variableSchema).refine((v) => Object.keys(v).length <= MAX_VARIABLES, `at most ${MAX_VARIABLES} variables per collection`)
  })
  .strict();

export const variablesSchema = z
  .record(name, collectionSchema)
  .refine((c) => Object.keys(c).length <= MAX_COLLECTIONS, `at most ${MAX_COLLECTIONS} collections`)
  .optional();

export const bindSchema = z.record(z.string().min(1).max(40), z.string().min(3).max(81)).optional();

export type Variable = z.infer<typeof variableSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type Variables = NonNullable<z.infer<typeof variablesSchema>>;
export type VarLiteral = z.infer<typeof literal>;
export type VarAlias = z.infer<typeof alias>;
export type VarInput = Pick<Variable, 'type' | 'values'>;

export const keyOf = (collection: string, variable: string) => `${collection}${KEY_SEPARATOR}${variable}`;

export function splitKey(key: string): [string, string] | null {
  const at = key.indexOf(KEY_SEPARATOR);
  return at < 1 ? null : [key.slice(0, at), key.slice(at + 1)];
}
