import { describe, expect, it } from 'vitest';
import { ListKind, indented, listedParagraphs, listsSchema, markersOf, normalLists, shiftLists } from './text-lists';

const bullet = (level = 0) => ({ kind: ListKind.Bullet, level });
const number = (level = 0) => ({ kind: ListKind.Number, level });

describe('list markers', () => {
  it('draws a bullet for every unordered item at any depth', () => {
    expect(markersOf([bullet(), bullet(1), null])).toEqual(['•', '•', null]);
  });

  it('numbers an ordered run and starts again after a plain paragraph', () => {
    expect(markersOf([number(), number(), null, number()])).toEqual(['1.', '2.', null, '1.']);
  });

  it('numbers a nested run on its own and restarts it under each parent item', () => {
    const lists = [number(), number(1), number(1), number(), number(1)];

    expect(markersOf(lists)).toEqual(['1.', 'a.', 'b.', '2.', 'a.']);
  });

  it('numbers a third depth in lower roman', () => {
    expect(markersOf([number(), number(1), number(2), number(2)])).toEqual(['1.', 'a.', 'i.', 'ii.']);
  });

  it('starts a number run again when it follows a bullet at the same depth', () => {
    expect(markersOf([number(), bullet(), number()])).toEqual(['1.', '•', '1.']);
  });
});

describe('list schema', () => {
  it('takes a list per paragraph with nulls for plain ones', () => {
    expect(listsSchema.parse([null, bullet(), number(2)])).toHaveLength(3);
  });

  it('refuses a depth beyond the limit and an unknown kind', () => {
    expect(() => listsSchema.parse([bullet(99)])).toThrow();
    expect(() => listsSchema.parse([{ kind: 'star', level: 0 }])).toThrow();
  });
});

describe('lists follow the text they describe', () => {
  it('Enter at the end of an item opens a next item of the same list', () => {
    expect(shiftLists([bullet(1)], 'one', 'one\n')).toEqual([bullet(1), bullet(1)]);
  });

  it('Enter in the middle of an item splits it into two items', () => {
    expect(shiftLists([null, number()], 'a\nbcd', 'a\nb\ncd')).toEqual([null, number(), number()]);
  });

  it('typing a letter changes nothing', () => {
    expect(shiftLists([bullet()], 'ab', 'abc')).toEqual([bullet()]);
  });

  it('deleting a line break merges the two items into the first', () => {
    expect(shiftLists([number(), number()], 'a\nb', 'ab')).toEqual([number()]);
  });

  it('Enter at the start of an item pushes it down and leaves an empty item above', () => {
    expect(shiftLists([bullet()], 'a', '\na')).toEqual([bullet(), bullet()]);
  });
});

describe('editing lists', () => {
  it('turns the paragraphs touched by a range into a list, and off again when every one already is', () => {
    const on = listedParagraphs([], 'one\ntwo\nthree', { start: 5, end: 9 }, ListKind.Bullet);

    expect(on).toEqual([null, bullet(), bullet()]);
    expect(listedParagraphs(on, 'one\ntwo\nthree', { start: 5, end: 9 }, ListKind.Bullet)).toEqual([]);
  });

  it('switches a bullet list to a numbered one', () => {
    expect(listedParagraphs([bullet()], 'a', { start: 0, end: 1 }, ListKind.Number)).toEqual([number()]);
  });

  it('Tab nests an item one level and Shift+Tab lifts it, never above the first level', () => {
    const down = indented([bullet()], 'a', { start: 0, end: 0 }, 1);

    expect(down).toEqual([bullet(1)]);
    expect(indented(down, 'a', { start: 0, end: 0 }, -1)).toEqual([bullet()]);
    expect(indented([bullet()], 'a', { start: 0, end: 0 }, -1)).toEqual([bullet()]);
  });

  it('leaves a plain paragraph alone when nested', () => {
    expect(indented([], 'a', { start: 0, end: 0 }, 1)).toEqual([]);
  });

  it('drops the trailing plain paragraphs so a text without lists has none', () => {
    expect(normalLists([null, null], 2)).toBeUndefined();
    expect(normalLists([bullet(), null, null], 3)).toEqual([bullet()]);
  });
});
