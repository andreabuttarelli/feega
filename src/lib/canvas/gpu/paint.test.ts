import { describe, expect, it } from 'vitest';
import { NODE_TYPES } from '../node-data';
import { PAINT, Paint, domPainted } from './paint';

describe('paint — which node bodies the GPU draws and which stay DOM when readable', () => {
  it('every node type has a row', () => {
    expect(Object.keys(PAINT).sort()).toEqual([...NODE_TYPES].sort());
  });

  it('a frame with any poster is GPU at once (a stale one is re-shot off-screen), one without stays DOM', () => {
    expect(PAINT.motion({ posterAssetId: 'p', posterRevision: 2, docHeadRevision: 2 })).toBe(Paint.Gpu);
    expect(PAINT.motion({ posterAssetId: 'p', docHeadRevision: 2 })).toBe(Paint.Gpu);
    expect(PAINT.motion({ posterAssetId: 'p', posterRevision: 1, docHeadRevision: 2 })).toBe(Paint.Gpu);
    expect(PAINT.motion({})).toBe(Paint.Dom);
    expect(PAINT.image({ assetId: 'a' })).toBe(Paint.Gpu);
    expect(PAINT.image({ prompt: 'x' })).toBe(Paint.Dom);
    expect(PAINT.video({ assetId: 'a' })).toBe(Paint.Dom);
    expect(PAINT.doc({})).toBe(Paint.Dom);
    expect(PAINT.calendar({})).toBe(Paint.Dom);
  });

  it('a DOM-painted node mounts whenever it is on screen, at any zoom', () => {
    const tiles = [
      { id: 'cal', kind: 'calendar', x: 0, y: 0, w: 100, h: 100 },
      { id: 'off', kind: 'calendar', x: 5000, y: 0, w: 100, h: 100 },
      { id: 'frame', kind: 'motion', x: 0, y: 0, w: 100, h: 100 },
      { id: 'pending', kind: 'pending_frame', x: 0, y: 0, w: 100, h: 100 }
    ];
    const data = (id: string) => (id === 'frame' ? { posterAssetId: 'p', posterRevision: 1, docHeadRevision: 1 } : {});
    const screen = { width: 800, height: 600 };
    expect(domPainted(tiles, data, { x: 0, y: 0, zoom: 1 }, screen)).toEqual(['cal', 'pending']);
    expect(domPainted(tiles, data, { x: 0, y: 0, zoom: 0.1 }, screen)).toEqual(['cal', 'off', 'pending']);
  });
});
