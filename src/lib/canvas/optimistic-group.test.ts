import { describe, expect, it } from 'vitest';
import { groupedLocally, inOrder, ungroupedLocally } from './optimistic-group';
import { layoutOf } from './node-layout';

type T = { id: string; x: number; y: number; w: number; h: number; data: Record<string, unknown>; select?: boolean };

const tile = (id: string, x: number, y: number, w: number, h: number, data: Record<string, unknown> = { kind: 'element' }): T => ({ id, x, y, w, h, data });
const fromRecord = (r: { id: string; position: { x: number; y: number }; size: { width: number | null; height: number | null }; data: Record<string, unknown> }): T => ({ id: r.id, x: r.position.x, y: r.position.y, w: r.size.width ?? 0, h: r.size.height ?? 0, data: r.data, select: true });

const canvas = [tile('a', 0, 0, 100, 50), tile('b', 200, 100, 100, 100), tile('c', 900, 900, 10, 10)];

describe('⌘G before the server answers', () => {
  const grouped = groupedLocally(canvas, ['a', 'b'], 'g', fromRecord);
  const group = grouped.find((t) => t.id === 'g')!;

  it('draws the group over the union of the picks, selected', () => {
    expect(group).toMatchObject({ x: 0, y: 0, w: 300, h: 200, select: true, data: { kind: 'group' } });
  });

  it('puts the group behind its members, so they stay where they were', () => {
    expect(grouped.map((t) => t.id)).toEqual(['g', 'a', 'b', 'c']);
    expect(grouped.slice(1).map(({ x, y }) => ({ x, y }))).toEqual(canvas.map(({ x, y }) => ({ x, y })));
  });

  it('makes the picks members, so they move with it', () => {
    expect(grouped.filter((t) => layoutOf(t.data).groupId === 'g').map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('leaves the rest of the canvas alone', () => {
    expect(grouped.find((t) => t.id === 'c')).toBe(canvas[2]);
  });

  it('changes nothing for a lone pick', () => {
    expect(groupedLocally(canvas, ['a', 'gone'], 'g', fromRecord)).toBe(canvas);
  });
});

describe('⇧⌘G before the server answers', () => {
  const grouped = groupedLocally(canvas, ['a', 'b'], 'g', fromRecord);
  const ungrouped = ungroupedLocally(grouped, 'g');

  it('lets every member go, selected', () => {
    expect(ungrouped.filter((t) => ['a', 'b'].includes(t.id)).map((t) => [layoutOf(t.data).groupId, t.select])).toEqual([
      [null, true],
      [null, true]
    ]);
  });

  it('keeps the group tile until the server turns its shapes into elements', () => {
    expect(ungrouped.some((t) => t.id === 'g')).toBe(true);
  });
});

describe('group changes in flight', () => {
  it('reach the server in the order they were made', async () => {
    const queue = inOrder();
    const seen: string[] = [];
    let release = () => {};
    const slow = new Promise<void>((done) => (release = done));

    const first = queue(async () => { await slow; seen.push('group'); });
    const second = queue(async () => { seen.push('ungroup'); });
    release();
    await Promise.all([first, second]);

    expect(seen).toEqual(['group', 'ungroup']);
  });

  it('keeps going after one fails', async () => {
    const queue = inOrder();
    const failed = queue(async () => { throw new Error('refused'); });
    const next = queue(async () => 'sent');

    await expect(failed).rejects.toThrow('refused');
    await expect(next).resolves.toBe('sent');
  });
});
