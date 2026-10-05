import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { batchZip } from './batch-zip';
import type { BatchView } from './render-run';

const view: BatchView = {
  id: 'b1',
  credits: 12,
  rows: [
    { row: 1, name: '001-alpha', runId: 'r1', status: 'done', progress: null, error: null, assetId: 'a1' },
    { row: 2, name: '002-beta', runId: 'r2', status: 'failed', progress: null, error: 'boom', assetId: null },
    { row: 3, name: '003-gamma', runId: 'r3', status: 'done', progress: null, error: null, assetId: 'a3' }
  ]
};

const files: Record<string, { path: string; bytes: string }> = { a1: { path: 'o/p/motion/n/r1-cc.mp4', bytes: 'one' }, a3: { path: 'o/p/motion/n/r3.mp4', bytes: 'three' } };

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('batchZip', () => {
  it('one file per finished row, named by its output name with the real extension', async () => {
    const zip = await collect(batchZip(view, { path: async (id) => files[id]?.path ?? null, bytes: async (path) => Buffer.from(Object.values(files).find((f) => f.path === path)!.bytes) }));

    const entries = unzipSync(zip);
    expect(Object.keys(entries).sort()).toEqual(['001-alpha.mp4', '003-gamma.mp4']);
    expect(strFromU8(entries['003-gamma.mp4'])).toBe('three');
  });
});
