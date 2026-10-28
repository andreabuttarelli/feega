import type { Vec } from './archive';

type Segment = { start: number; end: number; tangentStart: Vec; tangentEnd: Vec };
enum Closure {
  Closed = ' Z',
  Open = ''
}

export enum FillRule {
  NonZero = 'nonzero',
  EvenOdd = 'evenodd'
}

const ODD_WINDING = 1;

type Network = { vertices: Vec[]; segments: Segment[]; loops: number[][]; closure: Closure; rule: FillRule };

const VERTEX_BYTES = 12;
const SEGMENT_BYTES = 28;
const DIGITS = 100;

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;

function networkOf(blob: Uint8Array): Network | null {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const u32 = (at: number) => view.getUint32(at, true);
  const f32 = (at: number) => view.getFloat32(at, true);
  if (blob.length < 12) {
    return null;
  }
  const [vertexCount, segmentCount, regionCount] = [u32(0), u32(4), u32(8)];
  let at = 12;
  if (at + vertexCount * VERTEX_BYTES + segmentCount * SEGMENT_BYTES > blob.length) {
    return null;
  }
  const vertices: Vec[] = [];
  for (let i = 0; i < vertexCount; i++, at += VERTEX_BYTES) {
    vertices.push({ x: f32(at + 4), y: f32(at + 8) });
  }
  const segments: Segment[] = [];
  for (let i = 0; i < segmentCount; i++, at += SEGMENT_BYTES) {
    segments.push({ start: u32(at + 4), tangentStart: { x: f32(at + 8), y: f32(at + 12) }, end: u32(at + 16), tangentEnd: { x: f32(at + 20), y: f32(at + 24) } });
  }
  const loops: number[][] = [];
  const rule = at + 4 <= blob.length && u32(at) & ODD_WINDING ? FillRule.EvenOdd : FillRule.NonZero;
  for (let r = 0; r < regionCount && at + 8 <= blob.length; r++) {
    const loopCount = u32(at + 4);
    at += 8;
    for (let l = 0; l < loopCount && at + 4 <= blob.length; l++) {
      const count = u32(at);
      at += 4;
      loops.push(Array.from({ length: count }, (_, i) => u32(at + i * 4)));
      at += count * 4;
    }
  }
  return loops.length ? { vertices, segments, loops, closure: Closure.Closed, rule } : { vertices, segments, loops: [segments.map((_, i) => i)], closure: Closure.Open, rule };
}

const reversed = (s: Segment): Segment => ({ start: s.end, end: s.start, tangentStart: s.tangentEnd, tangentEnd: s.tangentStart });

const touches = (s: Segment | undefined, vertex: number) => s !== undefined && (s.start === vertex || s.end === vertex);

function entryOf(first: Segment | undefined, second: Segment | undefined): number {
  const backwards = first !== undefined && touches(second, first.start) && !touches(second, first.end);
  return backwards ? first.end : -1;
}

function loopPath(network: Network, loop: number[], scale: Vec): string {
  const pt = (v: Vec) => `${round(v.x * scale.x)} ${round(v.y * scale.y)}`;
  const parts: string[] = [];
  let last = entryOf(network.segments[loop[0]], network.segments[loop[1]]);
  for (const index of loop) {
    const given = network.segments[index];
    if (!given) {
      continue;
    }
    const s = given.start !== last && given.end === last ? reversed(given) : given;
    const [a, b] = [network.vertices[s.start], network.vertices[s.end]];
    if (!parts.length || s.start !== last) {
      parts.push(`M${pt(a)}`);
    }
    const straight = !s.tangentStart.x && !s.tangentStart.y && !s.tangentEnd.x && !s.tangentEnd.y;
    const c1 = { x: a.x + s.tangentStart.x, y: a.y + s.tangentStart.y };
    const c2 = { x: b.x + s.tangentEnd.x, y: b.y + s.tangentEnd.y };
    parts.push(straight ? `L${pt(b)}` : `C${pt(c1)} ${pt(c2)} ${pt(b)}`);
    last = s.end;
  }
  return parts.length ? `${parts.join(' ')}${network.closure}` : '';
}

export function networkPath(blob: Uint8Array, scale: Vec): { path: string; rule: FillRule } {
  const network = networkOf(blob);
  if (!network) {
    return { path: '', rule: FillRule.NonZero };
  }
  const path = network.loops
    .map((loop) => loopPath(network, loop, scale))
    .filter(Boolean)
    .join(' ');
  return { path, rule: network.rule };
}
