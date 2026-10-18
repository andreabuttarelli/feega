import { describe, expect, it } from 'vitest';
import { PORT_SIZE, portsOf } from './geometry';
import { chromeKey, idleChrome } from './idle-chrome';

const tile = { id: 'a', x: 100, y: 40, w: 200, h: 120, connectors: ['image', 'text'] as never[], output: 'image' as never };

describe('the chrome an idle node draws on the GPU', () => {
  it('puts every port square where the DOM handle sat, in the node’s own space', () => {
    const chrome = idleChrome(tile, 'Image', 'image', () => '#123456');
    const world = portsOf(tile).map((p) => ({ x: p.x - PORT_SIZE / 2 - tile.x, y: p.y - PORT_SIZE / 2 - tile.y }));
    expect(chrome.ports.map((p) => ({ x: p.x, y: p.y }))).toEqual(world);
    expect(chrome.ports.every((p) => p.color === '#123456')).toBe(true);
  });

  it('a node that cannot connect draws no ports', () => {
    expect(idleChrome({ ...tile, connectable: false }, null, null, () => '#000').ports).toEqual([]);
  });

  it('moving a node does not change what its chrome looks like', () => {
    const a = idleChrome(tile, 'Image', 'image', () => '#000');
    const b = idleChrome({ ...tile, x: 900, y: -40 }, 'Image', 'image', () => '#000');
    expect(chromeKey(b)).toBe(chromeKey(a));
    expect(chromeKey(idleChrome({ ...tile, h: 300 }, 'Image', 'image', () => '#000'))).not.toBe(chromeKey(a));
    expect(chromeKey(idleChrome(tile, 'Renamed', 'image', () => '#000'))).not.toBe(chromeKey(a));
  });
});
