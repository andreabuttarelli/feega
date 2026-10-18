import { z } from 'zod';
import { IMAGE_FORMATS, ImageFormat } from './still-model';

export enum SizeBy {
  Scale = 'scale',
  Width = 'width',
  Height = 'height'
}

export enum Bundle {
  File = 'file',
  Zip = 'zip'
}

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 4;
const MAX_SIDE = 8192;
const MAX_ROWS = 8;
const SUFFIX_MAX = 32;
const LOSSY = new Set([ImageFormat.Jpg, ImageFormat.Webp]);

const rowSchema = z
  .object({
    format: z.enum(IMAGE_FORMATS),
    by: z.enum(SizeBy).default(SizeBy.Scale),
    value: z.number().positive(),
    suffix: z.string().max(SUFFIX_MAX).default(''),
    quality: z.number().int().min(1).max(100).optional(),
    transparent: z.boolean().default(false)
  })
  .refine((r) => r.by !== SizeBy.Scale || (r.value >= MIN_SCALE && r.value <= MAX_SCALE), { message: `scale is ${MIN_SCALE}–${MAX_SCALE}×` })
  .refine((r) => r.by === SizeBy.Scale || (Number.isInteger(r.value) && r.value <= MAX_SIDE), { message: `a side is a whole number of pixels up to ${MAX_SIDE}` })
  .refine((r) => r.quality === undefined || LOSSY.has(r.format), { message: 'quality is for JPG and WebP' });

export const exportRowsSchema = z.array(rowSchema).min(1).max(MAX_ROWS);

export type ExportRow = z.infer<typeof rowSchema>;

type Size = { width: number; height: number };

export function rowSize(row: ExportRow, frame: Size): Size & { scale: number } {
  const scale = row.by === SizeBy.Scale ? row.value : row.value / (row.by === SizeBy.Width ? frame.width : frame.height);
  return { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale), scale };
}

export type ExportFrame = { id: string; name: string };

export type ExportFile = { frameId: string; row: ExportRow; name: string };

export function exportFiles(frames: readonly ExportFrame[], rows: readonly ExportRow[]): ExportFile[] {
  const seen = new Map<string, number>();
  return frames.flatMap((frame) => {
    const count = (seen.get(frame.name) ?? 0) + 1;
    seen.set(frame.name, count);
    const base = count === 1 ? frame.name : `${frame.name} ${count}`;
    return rows.map((row) => ({ frameId: frame.id, row, name: `${base}${row.suffix}.${row.format}` }));
  });
}

export const bundleOf = (files: number): Bundle => (files === 1 ? Bundle.File : Bundle.Zip);
