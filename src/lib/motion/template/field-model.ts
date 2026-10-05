import { z } from 'zod';

export enum FieldType {
  Text = 'text',
  Number = 'number',
  Color = 'color',
  Asset = 'asset',
  Boolean = 'boolean'
}

export const FIELD_TYPES = Object.values(FieldType) as [FieldType, ...FieldType[]];
export const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;
export const MAX_FIELDS = 50;

export const fieldSchema = z.object({
  key: z.string().regex(FIELD_KEY, 'field keys are snake_case, e.g. headline'),
  label: z.string().min(1).max(60),
  type: z.enum(FIELD_TYPES),
  clipId: z.string().min(1),
  prop: z.string().min(1).max(60),
  default: z.unknown()
});

export const fieldsSchema = z.array(fieldSchema).max(MAX_FIELDS).default([]);

export type ExposedField = z.infer<typeof fieldSchema>;
