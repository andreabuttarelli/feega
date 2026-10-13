import { z } from 'zod';

export const stillSchema = z.object({ frame: z.number().int().min(0) });

export type Still = z.infer<typeof stillSchema>;

export enum ImageFormat {
  Png = 'png',
  Jpg = 'jpg',
  Webp = 'webp'
}

export const IMAGE_FORMATS = Object.values(ImageFormat) as [ImageFormat, ...ImageFormat[]];

export enum ImageScale {
  One = 1,
  Two = 2
}

export const IMAGE_SCALES = [ImageScale.One, ImageScale.Two] as const;

const LOSSY_QUALITY = 92;

const IMAGE: Record<ImageFormat, { mime: string; ext: string; quality?: number }> = {
  [ImageFormat.Png]: { mime: 'image/png', ext: 'png' },
  [ImageFormat.Jpg]: { mime: 'image/jpeg', ext: 'jpg', quality: LOSSY_QUALITY },
  [ImageFormat.Webp]: { mime: 'image/webp', ext: 'webp', quality: LOSSY_QUALITY }
};

type Size = { width: number; height: number };

export type StillExport = { format: ImageFormat; scale: ImageScale; mime: string; ext: string; quality?: number; size: (doc: Size) => Size };

export const stillAskSchema = z.object({
  format: z.enum(IMAGE_FORMATS).default(ImageFormat.Png),
  scale: z.coerce.number().pipe(z.literal(IMAGE_SCALES)).default(ImageScale.One)
});

export function stillExport(format: ImageFormat, scale: ImageScale): StillExport {
  return { format, scale, ...IMAGE[format], size: (doc) => ({ width: doc.width * scale, height: doc.height * scale }) };
}
