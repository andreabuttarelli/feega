import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { exportFiles, exportRowsSchema } from '$lib/motion/export-rows';
import { ExportOutcome, exportSelection, packExport, type DrawTarget, type SelectionPorts } from './selection-export';
import { Background, MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';

const rows = exportRowsSchema.parse([{ format: 'png', by: 'scale', value: 1 }]);
const draw = async (file: { name: string }) => Buffer.from(file.name);

describe('packing an export', () => {
  it('one file is the file itself', async () => {
    const packed = await packExport(exportFiles([{ id: 'a', name: 'Poster' }], rows, 'Poster'), draw, 'Poster');

    expect(packed).toMatchObject({ name: 'Poster.png', mime: 'image/png' });
    expect(Buffer.from(packed.bytes).toString()).toBe('Poster.png');
  });

  it('several files are one zip holding each by its name', async () => {
    const packed = await packExport(exportFiles([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rows, 'Canvas'), draw, 'Canvas');

    expect(packed).toMatchObject({ name: 'Canvas.zip', mime: 'application/zip' });
    expect(Object.keys(unzipSync(packed.bytes))).toEqual(['A.png', 'B.png']);
  });
});

const square = newMotionDoc(MotionFormat.Square);
const titleId = 't1';
const titled = addClip(square, { component: 'Text', from: 0, props: { text: 'Hello' } }, titleId);
const withTitle = titled.ok ? titled.doc : square;

function ports() {
  const drawn: { targets: DrawTarget[]; format: string }[] = [];
  const stored: { name: string; mime: string }[] = [];
  const base: SelectionPorts = {
    read: async (nodeId) => (nodeId === 'gone' ? null : { name: `Frame ${nodeId}`, doc: withTitle }),
    draw: async (targets, row) => {
      drawn.push({ targets, format: row.format });
      return Buffer.from('x');
    },
    store: async (packed) => {
      stored.push({ name: packed.name, mime: packed.mime });
      return { asset_id: 'asset', url: 'https://x/y' };
    }
  };
  return { base, drawn, stored };
}

describe('exporting a selection', () => {
  it('draws every frame for every row, transparent when asked, and stores one zip', async () => {
    const { base, drawn, stored } = ports();
    const two = exportRowsSchema.parse([{ format: 'png', by: 'scale', value: 2, transparent: true }, { format: 'jpg', by: 'width', value: 540, quality: 70 }]);
    const out = await exportSelection(base, { targets: [{ nodeId: 'a' }, { nodeId: 'b' }], rows: two, name: 'Canvas' });

    expect(out).toMatchObject({ outcome: ExportOutcome.Done, name: 'Canvas.zip', files: ['Frame a.png', 'Frame a.jpg', 'Frame b.png', 'Frame b.jpg'] });
    expect(drawn[0].targets[0].doc.background).toBe(Background.Transparent);
    expect(drawn[1].targets[0].doc.background).not.toBe(Background.Transparent);
    expect(stored).toEqual([{ name: 'Canvas.zip', mime: 'application/zip' }]);
  });

  it('a PDF draws all frames at once as its pages', async () => {
    const { base, drawn, stored } = ports();
    await exportSelection(base, { targets: [{ nodeId: 'a' }, { nodeId: 'b' }], rows: exportRowsSchema.parse([{ format: 'pdf', by: 'scale', value: 1 }]), name: 'Deck' });

    expect(drawn.map((d) => d.targets.map((t) => t.nodeId))).toEqual([['a', 'b']]);
    expect(stored).toEqual([{ name: 'Deck.pdf', mime: 'application/pdf' }]);
  });

  it('one element inside a frame is drawn alone and named after it', async () => {
    const { base, drawn } = ports();
    const out = await exportSelection(base, { targets: [{ nodeId: 'a', elementId: titleId }], rows, name: 'X' });

    expect(drawn[0].targets[0].elementId).toBe(titleId);
    expect(out).toMatchObject({ outcome: ExportOutcome.Done });
    expect((out as { name: string }).name).toMatch(/^Frame a - .+\.png$/);
  });

  it('a frame or an element that is not there refuses the whole export before drawing anything', async () => {
    const { base, drawn } = ports();

    expect(await exportSelection(base, { targets: [{ nodeId: 'a' }, { nodeId: 'gone' }], rows, name: 'C' })).toEqual({ outcome: ExportOutcome.NotFound, nodeId: 'gone' });
    expect(await exportSelection(base, { targets: [{ nodeId: 'a', elementId: 'nope' }], rows, name: 'C' })).toEqual({ outcome: ExportOutcome.NoElement, nodeId: 'a', elementId: 'nope' });
    expect(drawn).toEqual([]);
  });
});
