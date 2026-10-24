import { describe, expect, it } from 'vitest';
import { SECTION_PAD, SECTION_TITLE_H, membersOf, sectionBoxAround, withMembers } from './section';

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
