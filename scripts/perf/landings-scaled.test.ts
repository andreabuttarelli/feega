import { describe, expect, it } from 'vitest';
import { scaled } from './landings-scaled.mjs';

const frame = (id: string, x: number) => ({ id, type: 'motion', position: { x, y: 0, z: 0 }, size: { width: 100, height: 300 }, data: {} });
const doc = { tracks: [{ clips: [{ component: 'Shape' }, { component: 'Text' }] }] };
const canvas = { nodes: [frame('00000000-0000-4000-8000-000000000001', 0), frame('00000000-0000-4000-8000-000000000002', 200)], connections: [], heads: { '00000000-0000-4000-8000-000000000001': { version: 1, doc }, '00000000-0000-4000-8000-000000000002': { version: 1, doc } }, assets: [] };

describe('a scaled landings canvas', () => {
  it('stacks copies of every frame in rows until it holds the asked layers', () => {
    const { canvas: out, layers } = scaled(canvas, 10);

    expect(layers).toBe(12);
    expect(out.nodes).toHaveLength(6);
    expect(new Set(out.nodes.map((n) => n.id)).size).toBe(6);
    expect(out.nodes.map((n) => n.position.y)).toEqual([0, 0, 4300, 4300, 8600, 8600]);
    expect(out.nodes.every((n, i) => out.heads[n.id] === canvas.heads[canvas.nodes[i % canvas.nodes.length].id])).toBe(true);
  });
});
