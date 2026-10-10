import { z } from 'zod';

export enum LookMiss {
  Unrecorded = 'look-unrecorded',
  TypeScale = 'look-type-scale',
  TypeScaleGross = 'look-type-scale-gross',
  Bleed = 'look-bleed',
  Columns = 'look-columns',
  NoSmallText = 'look-no-small-text',
  TypeFamily = 'look-type-family',
  TypeFamilySmall = 'look-type-family-small',
  TypeWeight = 'look-type-weight',
  TypeWeightGross = 'look-type-weight-gross',
  TypeTracking = 'look-type-tracking',
  TypeLeading = 'look-type-leading',
  TypeCase = 'look-type-case',
  TypeRoleMissing = 'look-type-role-missing',
  Rules = 'look-rules'
}

export enum SmallText {
  None = 'none',
  Some = 'some',
  Dense = 'dense'
}

export enum FontClass {
  Grotesk = 'grotesk',
  Condensed = 'condensed',
  Serif = 'serif',
  Mono = 'mono',
  Display = 'display',
  Script = 'script'
}

export enum Imagery {
  None = 'none',
  Shapes = 'shapes',
  Photo = 'photo',
  Illustration = 'illustration'
}

export enum TypeRole {
  Display = 'display',
  Headline = 'headline',
  Body = 'body',
  Label = 'label',
  Number = 'number'
}

export enum LetterCase {
  Upper = 'upper',
  Lower = 'lower',
  Mixed = 'mixed'
}

export const TYPE_ALIGNS = ['left', 'center', 'right'] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export const typeSpecSchema = z.object({
  role: z.enum(TypeRole),
  font: z.enum(FontClass),
  fonts: z.array(z.string().max(64)).min(1).max(3),
  weight: z.number().int().min(100).max(900),
  case: z.enum(LetterCase),
  tracking: z.number().min(-0.2).max(1),
  leading: z.number().min(0.6).max(3),
  size: z.number().min(0.005).max(1.2),
  align: z.enum(TYPE_ALIGNS),
  rotation: z.number().min(-180).max(180).optional(),
  measured: z.string().max(240).optional()
});

export type TypeSpec = z.infer<typeof typeSpecSchema>;

export const rulesSpecSchema = z.object({
  count: z.number().int().min(0).max(24),
  thickness: z.number().min(0.0002).max(0.03),
  gap: z.number().min(0).max(1).optional()
});

export const referenceLookSchema = z.object({
  typeScale: z.number().min(0.02).max(1.2),
  bleed: z.boolean(),
  columns: z.number().int().min(1).max(12),
  smallText: z.enum(SmallText),
  palette: z.array(z.string().regex(HEX)).min(1).max(8),
  font: z.enum(FontClass),
  imagery: z.enum(Imagery),
  type: z.array(typeSpecSchema).max(6).optional(),
  rules: rulesSpecSchema.optional(),
  margin: z.number().min(0).max(0.3).optional(),
  notes: z.string().max(400).optional(),
  avoid: z.array(z.object({ image: z.string().url().max(2000), why: z.string().max(240).optional() })).max(12).optional()
});

export type ReferenceLook = z.infer<typeof referenceLookSchema>;
