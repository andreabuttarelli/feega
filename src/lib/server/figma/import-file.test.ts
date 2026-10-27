import { describe, expect, it, vi } from 'vitest';
import { FigmaOutcome } from './import-images';
import { MAX_FRAMES, fetchFigmaFrames, listFigmaFrames } from './import-file';

const TOKEN = 'figd_token';
const FILE = 'AbCdEf1234567890';
const HEADERS = { headers: { 'X-Figma-Token': TOKEN } };

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

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
    const fetchFn = vi.fn(async () => answer(200, file));

    const done = await listFigmaFrames({ token: TOKEN, fileKey: FILE }, fetchFn);

    expect(done).toEqual({
      outcome: FigmaOutcome.Ok,
      frames: [
        { id: '1:2', name: 'Hero', page: 'Landing', width: 1440, height: 900 },
        { id: '1:4', name: 'Kit', page: 'Landing', width: 800, height: 600 }
      ]
    });
    expect(fetchFn).toHaveBeenCalledWith(`https://api.figma.com/v1/files/${FILE}?depth=2`, HEADERS);
  });

  it('reports a rejected token, a missing file and an unreachable Figma', async () => {
    expect((await listFigmaFrames({ token: TOKEN, fileKey: FILE }, async () => answer(403, {}))).outcome).toBe(FigmaOutcome.Rejected);
    expect((await listFigmaFrames({ token: TOKEN, fileKey: FILE }, async () => answer(404, {}))).outcome).toBe(FigmaOutcome.NotFound);
    expect((await listFigmaFrames({ token: TOKEN, fileKey: FILE }, async () => Promise.reject(new Error('down')))).outcome).toBe(FigmaOutcome.Unavailable);
  });

  it('refuses a file key that is not one', async () => {
    const fetchFn = vi.fn();

    expect((await listFigmaFrames({ token: TOKEN, fileKey: '../me' }, fetchFn)).outcome).toBe(FigmaOutcome.Invalid);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('fetching chosen frames with their geometry', () => {
  const nodes = { nodes: { '1:2': { document: { id: '1:2', name: 'Hero', type: 'FRAME' } }, '1:4': null } };

  it('asks for the vector paths and answers the frames that exist', async () => {
    const fetchFn = vi.fn(async () => answer(200, nodes));

    const done = await fetchFigmaFrames({ token: TOKEN, fileKey: FILE, nodeIds: ['1:2', '1:4'] }, fetchFn);

    expect(done).toEqual({ outcome: FigmaOutcome.Ok, frames: [{ id: '1:2', name: 'Hero', type: 'FRAME' }] });
    expect(fetchFn).toHaveBeenCalledWith(`https://api.figma.com/v1/files/${FILE}/nodes?ids=1%3A2%2C1%3A4&geometry=paths`, HEADERS);
  });

  it('refuses a malformed id and more frames than one import takes', async () => {
    const fetchFn = vi.fn();

    expect((await fetchFigmaFrames({ token: TOKEN, fileKey: FILE, nodeIds: ['x&y'] }, fetchFn)).outcome).toBe(FigmaOutcome.Invalid);
    expect((await fetchFigmaFrames({ token: TOKEN, fileKey: FILE, nodeIds: Array.from({ length: MAX_FRAMES + 1 }, (_, i) => `1:${i}`) }, fetchFn)).outcome).toBe(FigmaOutcome.Invalid);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
