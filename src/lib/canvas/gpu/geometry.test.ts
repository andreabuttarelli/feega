import { describe, expect, it } from 'vitest';
import { PortSide, edgeAt, portAt, portsOf, resizeCornerAt, wireCurve, Corner, containedIn } from './geometry';

const tile = { id: 'a', x: 100, y: 0, w: 200, h: 300, connectable: true, connectors: ['text', 'images'] as const, output: 'images' as const };

describe('portsOf', () => {
  it('spaces inputs evenly just outside the left edge and puts the single output mid-right, like the DOM handles', () => {
    const ports = portsOf({ ...tile, connectors: [...tile.connectors] });
    expect(ports).toEqual([
      { nodeId: 'a', side: PortSide.In, handle: 'text', port: 'text', x: 95, y: 100 },
      { nodeId: 'a', side: PortSide.In, handle: 'images', port: 'images', x: 95, y: 200 },
      { nodeId: 'a', side: PortSide.Out, handle: null, port: 'images', x: 305, y: 150 }
    ]);
  });

  it('gives named outputs their own handle id, spaced like inputs', () => {
    const ports = portsOf({ id: 'f', x: 0, y: 0, w: 100, h: 90, connectable: true, connectors: [], output: null, outputs: [{ handle: 'out:images', port: 'images' }, { handle: 'out:videos', port: 'videos' }] });
    expect(ports.filter((p) => p.side === PortSide.Out)).toEqual([
      { nodeId: 'f', side: PortSide.Out, handle: 'out:images', port: 'images', x: 105, y: 30 },
      { nodeId: 'f', side: PortSide.Out, handle: 'out:videos', port: 'videos', x: 105, y: 60 }
    ]);
  });

  it('a tile that is not connectable has no ports', () => {
    expect(portsOf({ ...tile, connectors: [], connectable: false })).toEqual([]);
  });

  it('an untyped connectable tile still has one generic in and out', () => {
    const ports = portsOf({ id: 'u', x: 0, y: 0, w: 10, h: 10, connectable: true });
    expect(ports.map((p) => [p.side, p.handle, p.port])).toEqual([
      [PortSide.In, null, null],
      [PortSide.Out, null, null]
    ]);
  });
});

describe('hit testing', () => {
  const ports = portsOf({ ...tile, connectors: [...tile.connectors] });

  it('finds a port within a screen-pixel radius whatever the zoom', () => {
    expect(portAt(ports, { x: 98, y: 101 }, 1)?.handle).toBe('text');
    expect(portAt(ports, { x: 120, y: 100 }, 1)).toBeNull();
    expect(portAt(ports, { x: 120, y: 100 }, 0.25)?.handle).toBe('text');
  });

  it('finds the resize corner of a selected tile', () => {
    expect(resizeCornerAt(tile, { x: 299, y: 299 }, 1)).toBe(Corner.BottomRight);
    expect(resizeCornerAt(tile, { x: 101, y: 1 }, 1)).toBe(Corner.TopLeft);
    expect(resizeCornerAt(tile, { x: 200, y: 150 }, 1)).toBeNull();
  });

  it('finds an edge near its curve', () => {
    const curve = wireCurve({ x: 0, y: 0 }, { x: 200, y: 0 });
    expect(edgeAt([{ id: 'e', curve }], { x: 100, y: 3 }, 1)).toBe('e');
    expect(edgeAt([{ id: 'e', curve }], { x: 100, y: 40 }, 1)).toBeNull();
  });
});

describe('wireCurve', () => {
  it('matches the xyflow bezier for a left-to-right wire', () => {
    const c = wireCurve({ x: 0, y: 0 }, { x: 100, y: 50 });
    expect(c.c1).toEqual({ x: 50, y: 0 });
    expect(c.c2).toEqual({ x: 50, y: 50 });
    expect(c.mid).toEqual({ x: 50, y: 25 });
  });

  it('bends outward when the target sits behind the source', () => {
    const c = wireCurve({ x: 100, y: 0 }, { x: 0, y: 0 });
    expect(c.c1.x).toBeCloseTo(100 + 0.25 * 25 * 10);
    expect(c.c2.x).toBeCloseTo(-0.25 * 25 * 10);
  });
});

describe('containedIn', () => {
  it('a picture shot at another aspect is letterboxed in the box, never stretched', () => {
    expect(containedIn({ w: 400, h: 100 }, { x: 10, y: 0, w: 100, h: 100 })).toEqual({ x: 10, y: 37.5, w: 100, h: 25 });
  });
});
