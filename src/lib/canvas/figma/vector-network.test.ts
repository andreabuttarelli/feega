import { describe, expect, it } from 'vitest';
import { networkPath } from './vector-network';

type V = [number, number];

function blob(vertices: V[], segments: [number, number][], loop: number[]): Uint8Array {
  const words: [string, number][] = [
    ['u', vertices.length],
    ['u', segments.length],
    ['u', 1],
    ...vertices.flatMap(([x, y]): [string, number][] => [['u', 0], ['f', x], ['f', y]]),
    ...segments.flatMap(([a, b]): [string, number][] => [['u', 0], ['u', a], ['f', 0], ['f', 0], ['u', b], ['f', 0], ['f', 0]]),
    ['u', 0],
    ['u', 1],
    ['u', loop.length],
    ...loop.map((i): [string, number] => ['u', i])
  ];
  const view = new DataView(new ArrayBuffer(words.length * 4));
  words.forEach(([kind, value], i) => (kind === 'u' ? view.setUint32(i * 4, value, true) : view.setFloat32(i * 4, value, true)));
  return new Uint8Array(view.buffer);
}

describe('a Figma vector network loop', () => {
  it('stays one contour when its first segment is stored backwards', () => {
    const square = blob([[0, 0], [10, 0], [10, 10], [0, 10]], [[1, 0], [1, 2], [2, 3], [3, 0]], [0, 1, 2, 3]);

    const { path } = networkPath(square, { x: 1, y: 1 });

    expect(path.match(/M/g)).toHaveLength(1);
    expect(path).toBe('M0 0 L10 0 L10 10 L0 10 L0 0 Z');
  });
});
