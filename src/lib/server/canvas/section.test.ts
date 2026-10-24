import { describe, expect, it, vi } from 'vitest';
import { MoveOutcome } from '$lib/server/motion/move-element';
import type { Member, Members } from '$lib/server/motion/element-groups';
import { SECTION_PAD, SECTION_TITLE_H } from '$lib/canvas/section';
import { wrapInSection } from './section';

const member = (id: string, left: number, top: number, width: number, height: number): Member => ({ id, box: { left, top, width, height }, rotation: 0, groupId: null, version: 1, data: {} });

function fixture(held: Member[]) {
  const joined: [string, string | null][] = [];
  const back: string[] = [];
  const members: Members = {
    read: async (ids) => held.filter((m) => ids.includes(m.id)),
    inGroup: async () => [],
    join: async (id, groupId) => {
      joined.push([id, groupId]);
      return { kind: 'node.update', nodeId: id, before: { data: {} }, after: { data: { groupId } }, expectedVersion: 2 };
    },
    place: async () => undefined,
    resize: async () => undefined,
    sendBack: async (id) => {
      back.push(id);
    }
  };
  const create = vi.fn(async (input: { id?: string }) => ({ id: input.id ?? 'made' }));
  return { members, create, joined, back };
}

describe('wrapping nodes in a section', () => {
  const held = [member('a', 100, 100, 200, 100), member('b', 400, 150, 100, 200)];

  it('creates a section around them, sends it behind, and joins each node to it', async () => {
    const { members, create, joined, back } = fixture(held);
    const moved = await wrapInSection({ members, create }, ['a', 'b'], 's1');

    expect(moved.outcome).toBe(MoveOutcome.Done);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', x: 100 - SECTION_PAD, y: 100 - SECTION_PAD - SECTION_TITLE_H, width: 400 + 2 * SECTION_PAD, height: 250 + 2 * SECTION_PAD + SECTION_TITLE_H }));
    expect(back).toEqual(['s1']);
    expect(joined).toEqual([['a', 's1'], ['b', 's1']]);
  });

  it('records what to undo: the section and each join', async () => {
    const { members, create } = fixture(held);
    const moved = await wrapInSection({ members, create }, ['a', 'b'], 's1');

    expect(moved.outcome === MoveOutcome.Done && moved.undo.map((u) => u.kind)).toEqual(['node.create', 'node.update', 'node.update']);
  });

  it('refuses when none of the nodes exist', async () => {
    const { members, create } = fixture([]);

    expect((await wrapInSection({ members, create }, ['gone'], 's1')).outcome).toBe(MoveOutcome.Invalid);
    expect(create).not.toHaveBeenCalled();
  });
});
