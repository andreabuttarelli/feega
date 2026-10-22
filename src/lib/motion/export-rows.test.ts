import { describe, expect, it } from 'vitest';
import { Bundle, EXPORT_PRESETS, FileFormat, SizeBy, bundleOf, exportFiles, exportRowsSchema, rowSize } from './export-rows';

const frame = { width: 1080, height: 1350 };

describe('export rows', () => {
  it('sizes a row by scale, or by a fixed width or height keeping the frame ratio', () => {
    expect(rowSize({ format: FileFormat.Png, by: SizeBy.Scale, value: 0.5, suffix: '', transparent: false }, frame)).toEqual({ width: 540, height: 675, scale: 0.5 });
    expect(rowSize({ format: FileFormat.Png, by: SizeBy.Width, value: 540, suffix: '', transparent: false }, frame)).toEqual({ width: 540, height: 675, scale: 0.5 });
    expect(rowSize({ format: FileFormat.Png, by: SizeBy.Height, value: 2700, suffix: '', transparent: false }, frame)).toEqual({ width: 2160, height: 2700, scale: 2 });
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
    const names = exportFiles([{ id: 'a', name: 'Poster' }, { id: 'b', name: 'Poster' }], rows, 'Deck').map((f) => f.name);

    expect(names).toEqual(['Poster.png', 'Poster@2x.png', 'Poster.jpg', 'Poster 2.png', 'Poster 2@2x.png', 'Poster 2.jpg']);
  });

  it('a PDF row is one file with a page per frame; SVG and raster rows are one file per frame', () => {
    const rows = exportRowsSchema.parse([{ format: 'pdf', by: 'scale', value: 1 }, { format: 'svg', by: 'scale', value: 1 }]);
    const files = exportFiles([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rows, 'Deck');

    expect(files.map((f) => [f.name, f.targets.map((t) => t.id)])).toEqual([
      ['Deck.pdf', ['a', 'b']],
      ['A.svg', ['a']],
      ['B.svg', ['b']]
    ]);
  });

  it('a PDF of one frame is named after it; one element is named after its frame and itself', () => {
    const rows = exportRowsSchema.parse([{ format: 'pdf', by: 'scale', value: 1 }, { format: 'png', by: 'scale', value: 1 }]);
    const files = exportFiles([{ id: 'a', name: 'Poster', elementId: 'title', elementName: 'Title' }], rows, 'Deck');

    expect(files.map((f) => f.name)).toEqual(['Poster - Title.pdf', 'Poster - Title.png']);
  });

  it('one file downloads as itself, several as one zip', () => {
    expect(bundleOf(1)).toBe(Bundle.File);
    expect(bundleOf(2)).toBe(Bundle.Zip);
  });
});

describe('export presets', () => {
  it('offer PNG at 1x to 4x and SVG, each a valid single row', () => {
    expect(EXPORT_PRESETS.map((p) => p.label)).toEqual(['1×', '2×', '3×', '4×', 'SVG']);
    for (const preset of EXPORT_PRESETS) {
      expect(exportRowsSchema.safeParse([preset.row]).success).toBe(true);
    }
    expect(EXPORT_PRESETS[3].row).toMatchObject({ format: FileFormat.Png, by: SizeBy.Scale, value: 4 });
  });
});
