import { describe, expect, test } from 'bun:test';
import { rank, type Findable } from './surface.ts';

describe('find_tools ranks every entry', () => {
  test('an entry with no summary is ranked by its name, not a crash', () => {
    const entries = [{ name: 'move_node', family: 'canvas' } as unknown as Findable, { name: 'add_shape', family: 'frame', summary: 'a shape' }];

    expect(rank(entries, 'move').map((e) => e.name)).toEqual(['move_node']);
  });
});
