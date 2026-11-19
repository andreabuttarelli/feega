import { describe, expect, it, vi } from 'vitest';
import { FigmaOutcome } from './import-images';
import { MAX_FRAMES, fetchFigmaFrames, listFigmaFrames } from './import-file';

const FILE = 'AbCdEf1234567890';

const answer = (status: number, data: unknown) => ({ status, data, headers: {}, file: null });

const file = {
  document: {
    children: [
      {
        id: '0:1',
        name: 'Landing',
        type: 'CANVAS',
        children: [
          { id: '1:2', name: 'Hero', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 } },
          { id: '1:3', name: 'note', type: 'TEXT', absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 } },
          { id: '1:4', name: 'Kit', type: 'SECTION', absoluteBoundingBox: { x: 0, y: 1000, width: 800, height: 600 } }
        ]
      },
      { id: '0:2', name: 'Empty', type: 'CANVAS', children: [] }
    ]
  }
};

describe('listing the frames of a Figma file', () => {
  it('reads the top-level frames of every page and nothing else', async () => {
    const call = vi.fn(async () => answer(200, file));

    const done = await listFigmaFrames({ fileKey: FILE }, call);

    expect(done).toEqual({
      outcome: FigmaOutcome.Ok,
      frames: [
        { id: '1:2', name: 'Hero', page: 'Landing', width: 1440, height: 900 },
        { id: '1:4', name: 'Kit', page: 'Landing', width: 800, height: 600 }
      ]
    });
    expect(call).toHaveBeenCalledWith({ endpoint: `https://api.figma.com/v1/files/${FILE}`, query: { depth: '2' } });
  });

  it('reports a rejected connection, a missing file and an unreachable Figma', async () => {
    expect((await listFigmaFrames({ fileKey: FILE }, async () => answer(403, {}))).outcome).toBe(FigmaOutcome.Rejected);
    expect((await listFigmaFrames({ fileKey: FILE }, async () => answer(404, {}))).outcome).toBe(FigmaOutcome.NotFound);
    expect((await listFigmaFrames({ fileKey: FILE }, async () => answer(0, null))).outcome).toBe(FigmaOutcome.Unavailable);
  });

  it('refuses a file key that is not one', async () => {
    const call = vi.fn();

    expect((await listFigmaFrames({ fileKey: '../me' }, call)).outcome).toBe(FigmaOutcome.Invalid);
    expect(call).not.toHaveBeenCalled();
  });
});

describe('fetching chosen frames with their geometry', () => {
  const nodes = { nodes: { '1:2': { document: { id: '1:2', name: 'Hero', type: 'FRAME' } }, '1:4': null } };

  it('asks for the vector paths and answers the frames that exist', async () => {
    const call = vi.fn(async () => answer(200, nodes));

    const done = await fetchFigmaFrames({ fileKey: FILE, nodeIds: ['1:2', '1:4'] }, call);

    expect(done).toEqual({ outcome: FigmaOutcome.Ok, frames: [{ id: '1:2', name: 'Hero', type: 'FRAME' }] });
    expect(call).toHaveBeenCalledWith({ endpoint: `https://api.figma.com/v1/files/${FILE}/nodes`, query: { ids: '1:2,1:4', geometry: 'paths' } });
  });

  it('refuses a malformed id and more frames than one import takes', async () => {
    const call = vi.fn();

    expect((await fetchFigmaFrames({ fileKey: FILE, nodeIds: ['x&y'] }, call)).outcome).toBe(FigmaOutcome.Invalid);
    expect((await fetchFigmaFrames({ fileKey: FILE, nodeIds: Array.from({ length: MAX_FRAMES + 1 }, (_, i) => `1:${i}`) }, call)).outcome).toBe(FigmaOutcome.Invalid);
    expect(call).not.toHaveBeenCalled();
  });
});
