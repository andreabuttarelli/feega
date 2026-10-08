import { z } from 'zod';

export enum FieldType {
  Text = 'text',
  Number = 'number',
  Color = 'color',
  Asset = 'asset',
  Boolean = 'boolean',
  Select = 'select',
  MediaList = 'media_list'
}

export const FIELD_TYPES = Object.values(FieldType) as [FieldType, ...FieldType[]];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  [FieldType.Text]: 'Text',
  [FieldType.Number]: 'Number',
  [FieldType.Color]: 'Colour',
  [FieldType.Asset]: 'Media',
  [FieldType.Boolean]: 'Yes / no',
  [FieldType.Select]: 'Choice',
  [FieldType.MediaList]: 'Media list'
};
export const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;
export const MAX_FIELDS = 50;
export const MAX_OPTIONS = 20;

export const MAX_LINKED = 12;

const targetSchema = z.object({ clipId: z.string().min(1), prop: z.string().min(1).max(60) });

export const fieldSchema = z.object({
  key: z.string().regex(FIELD_KEY, 'field keys are snake_case, e.g. headline'),
  label: z.string().min(1).max(60),
  type: z.enum(FIELD_TYPES),
  clipId: z.string().min(1),
  prop: z.string().min(1).max(60),
  default: z.unknown(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().max(12).optional(),
  options: z.array(z.string().min(1).max(60)).min(1).max(MAX_OPTIONS).optional(),
  aspect: z.number().positive().max(10).optional(),
  also: z.array(targetSchema).max(MAX_LINKED).optional()
});

export const fieldsSchema = z.array(fieldSchema).max(MAX_FIELDS).default([]);

export type ExposedField = z.infer<typeof fieldSchema>;
