import { z } from 'zod';

export enum FileFormat {
  Png = 'png',
  Jpg = 'jpg',
  Webp = 'webp',
  Svg = 'svg',
  Pdf = 'pdf'
}

export const FILE_FORMATS = Object.values(FileFormat) as [FileFormat, ...FileFormat[]];

export enum Drawing {
  Raster = 'raster',
  Vector = 'vector',
  Pages = 'pages'
}

const LOSSY_QUALITY = 92;

export const FILE: Record<FileFormat, { mime: string; drawing: Drawing; label: string; quality?: number }> = {
  [FileFormat.Png]: { mime: 'image/png', drawing: Drawing.Raster, label: 'PNG' },
  [FileFormat.Jpg]: { mime: 'image/jpeg', drawing: Drawing.Raster, label: 'JPG', quality: LOSSY_QUALITY },
  [FileFormat.Webp]: { mime: 'image/webp', drawing: Drawing.Raster, label: 'WebP', quality: LOSSY_QUALITY },
  [FileFormat.Svg]: { mime: 'image/svg+xml', drawing: Drawing.Vector, label: 'SVG' },
  [FileFormat.Pdf]: { mime: 'application/pdf', drawing: Drawing.Pages, label: 'PDF' }
};

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
export const LOSSY: ReadonlySet<FileFormat> = new Set([FileFormat.Jpg, FileFormat.Webp]);

const rowSchema = z
  .object({
    format: z.enum(FILE_FORMATS),
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

const PRESET_SCALES = [1, 2, 3, 4];

export const EXPORT_PRESETS: readonly { label: string; row: ExportRow }[] = [
  ...PRESET_SCALES.map((value) => ({ label: `${value}×`, row: { format: FileFormat.Png, by: SizeBy.Scale, value, suffix: value === 1 ? '' : `@${value}x`, transparent: true } })),
  { label: FILE[FileFormat.Svg].label, row: { format: FileFormat.Svg, by: SizeBy.Scale, value: 1, suffix: '', transparent: true } }
];

export const exportElementsSchema = z.array(z.object({ frameId: z.string(), elementId: z.string() }).strict()).max(50);

type Size = { width: number; height: number };

export function rowSize(row: ExportRow, frame: Size): Size & { scale: number } {
  const scale = row.by === SizeBy.Scale ? row.value : row.value / (row.by === SizeBy.Width ? frame.width : frame.height);
  return { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale), scale };
}

export type ExportFrame = { id: string; name: string; elementId?: string; elementName?: string };

export type ExportFile = { targets: ExportFrame[]; row: ExportRow; name: string };

const nameOf = (frame: ExportFrame) => (frame.elementName ? `${frame.name} - ${frame.elementName}` : frame.name);

export function exportFiles(frames: readonly ExportFrame[], rows: readonly ExportRow[], bundleName: string): ExportFile[] {
  const seen = new Map<string, number>();
  const named = frames.map((frame) => {
    const base = nameOf(frame);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { frame, base: count === 1 ? base : `${base} ${count}` };
  });
  const paged = rows.filter((row) => FILE[row.format].drawing === Drawing.Pages).map((row) => ({ targets: [...frames], row, name: `${frames.length === 1 ? named[0].base : bundleName}${row.suffix}.${row.format}` }));
  const single = named.flatMap(({ frame, base }) => rows.filter((row) => FILE[row.format].drawing !== Drawing.Pages).map((row) => ({ targets: [frame], row, name: `${base}${row.suffix}.${row.format}` })));
  return [...paged, ...single];
}

export const bundleOf = (files: number): Bundle => (files === 1 ? Bundle.File : Bundle.Zip);
