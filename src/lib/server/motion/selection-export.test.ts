import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { exportFiles, exportRowsSchema } from '$lib/motion/export-rows';
import { ExportOutcome, exportSelection, packExport, type SelectionPorts } from './selection-export';
import { Background, MotionFormat, newMotionDoc } from '$lib/motion/doc';

const rows = exportRowsSchema.parse([{ format: 'png', by: 'scale', value: 1 }]);
const draw = async (file: { name: string }) => Buffer.from(file.name);

describe('packing an export', () => {
  it('one file is the file itself', async () => {
    const packed = await packExport(exportFiles([{ id: 'a', name: 'Poster' }], rows), draw, 'Poster');

    expect(packed).toMatchObject({ name: 'Poster.png', mime: 'image/png' });
    expect(Buffer.from(packed.bytes).toString()).toBe('Poster.png');
  });

  it('several files are one zip holding each by its name', async () => {
    const packed = await packExport(exportFiles([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rows), draw, 'Canvas');

    expect(packed).toMatchObject({ name: 'Canvas.zip', mime: 'application/zip' });
    expect(Object.keys(unzipSync(packed.bytes))).toEqual(['A.png', 'B.png']);
  });
});

function ports(over: Partial<SelectionPorts> = {}) {
  const drawn: { nodeId: string; scale: number; mime: string; background: string }[] = [];
  const stored: { name: string; mime: string }[] = [];
  const base: SelectionPorts = {
    read: async (nodeId) => (nodeId === 'gone' ? null : { name: `Frame ${nodeId}`, doc: newMotionDoc(MotionFormat.Square) }),
    draw: async (nodeId, doc, spec) => {
      drawn.push({ nodeId, scale: spec.scale, mime: spec.mime, background: doc.background });
      return Buffer.from('x');
    },
    store: async (packed) => {
      stored.push({ name: packed.name, mime: packed.mime });
      return { asset_id: 'asset', url: 'https://x/y' };
    },
    ...over
  };
  return { base, drawn, stored };
}

describe('exporting a selection', () => {
  it('draws every frame for every row at its size, transparent when asked, and stores one zip', async () => {
    const { base, drawn, stored } = ports();
    const rows = exportRowsSchema.parse([{ format: 'png', by: 'scale', value: 2, transparent: true }, { format: 'jpg', by: 'width', value: 540, quality: 70 }]);
    const out = await exportSelection(base, { nodeIds: ['a', 'b'], rows, name: 'Canvas' });

    expect(out).toMatchObject({ outcome: ExportOutcome.Done, name: 'Canvas.zip', files: ['Frame a.png', 'Frame a.jpg', 'Frame b.png', 'Frame b.jpg'] });
    expect(drawn[0]).toEqual({ nodeId: 'a', scale: 2, mime: 'image/png', background: Background.Transparent });
    expect(drawn[1]).toMatchObject({ scale: 0.5, mime: 'image/jpeg' });
    expect(stored).toEqual([{ name: 'Canvas.zip', mime: 'application/zip' }]);
  });

  it('a frame that is not there refuses the whole export before drawing anything', async () => {
    const { base, drawn } = ports();
    const out = await exportSelection(base, { nodeIds: ['a', 'gone'], rows, name: 'Canvas' });

    expect(out).toEqual({ outcome: ExportOutcome.NotFound, nodeId: 'gone' });
    expect(drawn).toEqual([]);
  });
});
