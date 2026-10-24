import { describe, expect, it } from 'vitest';
import { SECTION_PAD, SECTION_TITLE_H, membersOf, membershipAfter, sectionBoxAround, withMembers } from './section';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe('a section wrapped around nodes', () => {
  it('covers their union with a margin all round and room for the title on top', () => {
    const around = sectionBoxAround([box(100, 200, 300, 100), box(500, 250, 100, 300)]);

    expect(around).toEqual({ left: 100 - SECTION_PAD, top: 200 - SECTION_PAD - SECTION_TITLE_H, width: 500 + 2 * SECTION_PAD, height: 350 + 2 * SECTION_PAD + SECTION_TITLE_H });
  });
});

describe('what a section holds', () => {
  const nodes = [
    { id: 's', type: 'section', data: {} },
    { id: 'a', type: 'text', data: { groupId: 's' } },
    { id: 'b', type: 'motion', data: { groupId: 's' } },
    { id: 'c', type: 'text', data: {} }
  ];

  it('is every node whose group is the section', () => {
    expect(membersOf(nodes, 's')).toEqual(['a', 'b']);
  });

  it('goes with the section when it is deleted, unless the contents are kept', () => {
    expect(withMembers(nodes, ['s'])).toEqual(['s', 'a', 'b']);
    expect(withMembers(nodes, ['c'])).toEqual(['c']);
  });
});

describe('where a dragged node ends up', () => {
  const area = (id: string, x: number, y: number, w: number, h: number, data: Record<string, unknown> = {}, type = 'text') => ({ id, type, x, y, w, h, data });
  const nodes = [area('s', 0, 0, 400, 300, {}, 'section'), area('in', 50, 100, 100, 50, { groupId: 's' }), area('out', 600, 0, 100, 50), area('grouped', 600, 200, 100, 50, { groupId: 'g' })];
  const to = (id: string, x: number, y: number) => ({ id, x, y });

  it('joins the section it is dropped into', () => {
    expect(membershipAfter(nodes, [to('out', 100, 100)])).toEqual([{ id: 'out', groupId: 's' }]);
  });

  it('leaves the section it is dragged out of', () => {
    expect(membershipAfter(nodes, [to('in', 800, 100)])).toEqual([{ id: 'in', groupId: null }]);
  });

  it('stays put when it lands where it already belongs', () => {
    expect(membershipAfter(nodes, [to('in', 60, 110)])).toEqual([]);
  });

  it('is left alone when it moves with its section', () => {
    expect(membershipAfter(nodes, [to('s', 100, 100), to('in', 150, 200)])).toEqual([]);
  });

  it('keeps an element group and never nests a section', () => {
    expect(membershipAfter(nodes, [to('grouped', 100, 100), to('s', 0, 0)])).toEqual([]);
  });
});
