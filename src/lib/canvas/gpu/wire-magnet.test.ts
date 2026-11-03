import { describe, expect, it } from 'vitest';
import { UNTYPED_BUBBLE, WIRE_CURSOR, WireAim, Wiring, atRest, bubbleColour, bubbleRadius, crossings, magnetPort, springTo, throughPoint, tieAcross, wireAim, type Spring } from './wire-magnet';
import { CONNECTOR_STYLE } from '../connectors';
import { PortSide, curvePoint, wireCurve, type Port } from './geometry';

const port = (nodeId: string, x: number, y: number): Port => ({ nodeId, side: PortSide.In, handle: null, port: null, x, y });

describe('magnetPort — the nearest port that would accept the wire, within reach', () => {
  const ports = [port('a', 0, 0), port('b', 30, 0), port('c', 100, 0)];

  it('picks the nearest accepted port', () => {
    expect(magnetPort(ports, { x: 20, y: 0 }, 50, () => true)?.nodeId).toBe('b');
  });

  it('skips a closer port that would refuse the wire', () => {
    expect(magnetPort(ports, { x: 20, y: 0 }, 50, (p) => p.nodeId !== 'b')?.nodeId).toBe('a');
  });

  it('attracts nothing beyond reach', () => {
    expect(magnetPort(ports, { x: 60, y: 60 }, 30, () => true)).toBeNull();
  });
});

describe('bubbleRadius — swells as the wire end closes in', () => {
  it('is largest on the port and resting at the edge of reach', () => {
    expect(bubbleRadius(0, 40, 6, 18)).toBe(18);
    expect(bubbleRadius(40, 40, 6, 18)).toBe(6);
    expect(bubbleRadius(80, 40, 6, 18)).toBe(6);
    expect(bubbleRadius(20, 40, 6, 18)).toBeGreaterThan(6);
    expect(bubbleRadius(20, 40, 6, 18)).toBeLessThan(18);
  });
});

describe('springTo — eased motion without jumps', () => {
  it('moves part of the way per frame and converges on the target', () => {
    let s: Spring = { value: 0, velocity: 0 };
    s = springTo(s, 100, 1 / 60);
    expect(s.value).toBeGreaterThan(0);
    expect(s.value).toBeLessThan(50);
    for (let i = 0; i < 120; i++) {
      s = springTo(s, 100, 1 / 60);
    }
    expect(atRest(s, 100)).toBe(true);
  });

  it('survives a long frame without exploding', () => {
    const s = springTo({ value: 0, velocity: 0 }, 100, 1);
    expect(Number.isFinite(s.value)).toBe(true);
    expect(Math.abs(s.value)).toBeLessThan(200);
  });
});

describe('throughPoint — a tied wire passes through its tie', () => {
  it('bends the curve so its midpoint lands on the tie', () => {
    const c = throughPoint(wireCurve({ x: 0, y: 0 }, { x: 200, y: 100 }), { x: 80, y: 120 });
    const mid = curvePoint(c, 0.5);
    expect(mid.x).toBeCloseTo(80);
    expect(mid.y).toBeCloseTo(120);
    expect(c.mid).toEqual({ x: 80, y: 120 });
    expect(c.from).toEqual({ x: 0, y: 0 });
    expect(c.to).toEqual({ x: 200, y: 100 });
  });
});

describe('tieAcross — a stroke across wires bundles the ones it cuts', () => {
  const wires = [0, 20, 40, 60, 80].map((y, i) => ({ id: `w${i}`, curve: wireCurve({ x: 0, y }, { x: 200, y }) }));

  it('finds every wire the stroke crosses and ties them where it crossed', () => {
    const tie = tieAcross(wires, { x: 100, y: -10 }, { x: 100, y: 90 });
    expect(tie?.ids).toEqual(['w0', 'w1', 'w2', 'w3', 'w4']);
    expect(tie?.at.x).toBeCloseTo(100);
    expect(tie?.at.y).toBeCloseTo(40);
  });

  it('needs at least two wires to tie', () => {
    expect(tieAcross(wires, { x: 100, y: -10 }, { x: 100, y: 5 })).toBeNull();
  });

  it('counts a wire once', () => {
    expect(crossings(wires[0].curve, { x: 100, y: -10 }, { x: 100, y: 10 })).toHaveLength(1);
  });
});

describe('bubbleColour — the bubble wears the colour of the port it is drawn to', () => {
  it('uses the connector colour of a typed port, the accent for an untyped one', () => {
    expect(bubbleColour({ ...port('a', 0, 0), port: 'images' })).toBe(CONNECTOR_STYLE.images.color);
    expect(bubbleColour(port('a', 0, 0))).toBe(UNTYPED_BUBBLE);
  });
});

describe('wireAim — the cursor tells what a release would do', () => {
  const p = port('a', 0, 0);
  it('idle: crosshair on a port, default elsewhere', () => {
    expect(wireAim(Wiring.Idle, p, null)).toBe(WireAim.Port);
    expect(wireAim(Wiring.Idle, null, null)).toBe(WireAim.None);
  });
  it('dragging: drop inside a bubble, refused on a port that would not take it, default elsewhere', () => {
    expect(wireAim(Wiring.Dragging, p, p)).toBe(WireAim.Drop);
    expect(wireAim(Wiring.Dragging, null, p)).toBe(WireAim.Drop);
    expect(wireAim(Wiring.Dragging, p, null)).toBe(WireAim.Refused);
    expect(wireAim(Wiring.Dragging, null, null)).toBe(WireAim.None);
    expect(WIRE_CURSOR[WireAim.Drop]).toBe('copy');
    expect(WIRE_CURSOR[WireAim.Refused]).toBe('not-allowed');
  });
});
