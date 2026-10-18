import { describe, expect, it } from 'vitest';
import { ImageFormat } from './still-model';
import { Bundle, SizeBy, bundleOf, exportFiles, exportRowsSchema, rowSize } from './export-rows';

const frame = { width: 1080, height: 1350 };

describe('export rows', () => {
  it('sizes a row by scale, or by a fixed width or height keeping the frame ratio', () => {
    expect(rowSize({ format: ImageFormat.Png, by: SizeBy.Scale, value: 0.5, suffix: '', transparent: false }, frame)).toEqual({ width: 540, height: 675, scale: 0.5 });
    expect(rowSize({ format: ImageFormat.Png, by: SizeBy.Width, value: 540, suffix: '', transparent: false }, frame)).toEqual({ width: 540, height: 675, scale: 0.5 });
    expect(rowSize({ format: ImageFormat.Png, by: SizeBy.Height, value: 2700, suffix: '', transparent: false }, frame)).toEqual({ width: 2160, height: 2700, scale: 2 });
  });

  it('refuses a scale outside 0.5–4× and a lossless format with a quality', () => {
    expect(exportRowsSchema.safeParse([{ format: 'png', by: 'scale', value: 5 }]).success).toBe(false);
    expect(exportRowsSchema.safeParse([{ format: 'png', by: 'scale', value: 0.25 }]).success).toBe(false);
    expect(exportRowsSchema.safeParse([{ format: 'jpg', by: 'scale', value: 2, quality: 80 }]).success).toBe(true);
    expect(exportRowsSchema.safeParse([]).success).toBe(false);
  });

  it('names every file after its frame and row suffix, never two files with one name', () => {
    const rows = exportRowsSchema.parse([
      { format: 'png', by: 'scale', value: 1 },
      { format: 'png', by: 'scale', value: 2, suffix: '@2x' },
      { format: 'jpg', by: 'scale', value: 1 }
    ]);
    const names = exportFiles([{ id: 'a', name: 'Poster' }, { id: 'b', name: 'Poster' }], rows).map((f) => f.name);

    expect(names).toEqual(['Poster.png', 'Poster@2x.png', 'Poster.jpg', 'Poster 2.png', 'Poster 2@2x.png', 'Poster 2.jpg']);
  });

  it('one file downloads as itself, several as one zip', () => {
    expect(bundleOf(1)).toBe(Bundle.File);
    expect(bundleOf(2)).toBe(Bundle.Zip);
  });
});
