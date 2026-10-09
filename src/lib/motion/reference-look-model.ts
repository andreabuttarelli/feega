import { z } from 'zod';

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

const HEX = /^#[0-9a-fA-F]{6}$/;

export const referenceLookSchema = z.object({
  typeScale: z.number().min(0.02).max(1.2),
  bleed: z.boolean(),
  columns: z.number().int().min(1).max(12),
  smallText: z.enum(SmallText),
  palette: z.array(z.string().regex(HEX)).min(1).max(8),
  font: z.enum(FontClass),
  imagery: z.enum(Imagery),
  notes: z.string().max(400).optional()
});

export type ReferenceLook = z.infer<typeof referenceLookSchema>;
