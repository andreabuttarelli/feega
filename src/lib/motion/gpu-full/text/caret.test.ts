import { describe, expect, it } from 'vitest';
import { caretLines, caretRect, charUnder, codePointsOf, dragged, Grain, hitTest, laidAsTyped, lineEdge, lineRange, nextLine, pressed, selectionBoxes, Step, unitsOf, wordRange } from './caret';
import { layOut, Shaping, Spaces, type Flow, type Type } from './layout';
import { boxBook } from './test-face';

const SIZE = 100;
const ADVANCE = 50;
const SPACE_ADVANCE = 25;
const LINE = 120;
const INK_TOP = 10;
const INK = 100;
const type: Type = { request: { family: 'sans', weight: 400, italic: false, axes: {} }, size: SIZE, tracking: 0, leading: 1.2, inset: 0, shaping: Shaping.Runs };
const keep: Flow = { spaces: Spaces.Keep, wraps: true };

const linesOf = (text: string, room = 10_000, align = 0) => {
  const paragraphs = text.split('\n');
  return caretLines(layOut(paragraphs, type, keep, room, boxBook()), paragraphs, { room, align, top: 0, space: SPACE_ADVANCE });
};

describe('caretRect', () => {
  it('puts the caret between two glyphs at the second glyph pen', () => {
    expect(caretRect(linesOf('abc'), 2)).toEqual({ x: 2 * ADVANCE, top: INK_TOP, height: INK });
  });

  it('puts the end of a line after its last glyph', () => {
    expect(caretRect(linesOf('abc'), 3).x).toBe(3 * ADVANCE);
  });

  it('moves to the next paragraph after a newline', () => {
    expect(caretRect(linesOf('ab\ncd'), 3)).toEqual({ x: 0, top: LINE + INK_TOP, height: INK });
  });

  it('keeps the caret at the right of a paragraph that ends before the newline', () => {
    expect(caretRect(linesOf('ab\ncd'), 2)).toEqual({ x: 2 * ADVANCE, top: INK_TOP, height: INK });
  });

  it('rests on an empty paragraph at its own line', () => {
    expect(caretRect(linesOf('a\n\nb'), 2)).toEqual({ x: 0, top: LINE + INK_TOP, height: INK });
  });

  it('follows the line alignment', () => {
    expect(caretRect(linesOf('ab', 300, 0.5), 0).x).toBe((300 - 2 * ADVANCE) / 2);
  });

  it('wraps: the first offset of the second line is drawn on the second line', () => {
    const lines = linesOf('aa bb', 2 * ADVANCE + SPACE_ADVANCE);
    expect(caretRect(lines, 3)).toEqual({ x: 0, top: LINE + INK_TOP, height: INK });
    expect(caretRect(lines, 2).top).toBe(INK_TOP);
  });
});

describe('hitTest', () => {
  it('picks the nearest gap on the line under the point', () => {
    expect(hitTest(linesOf('abcd'), 130, 10)).toBe(3);
    expect(hitTest(linesOf('abcd'), 110, 10)).toBe(2);
  });

  it('clamps below and beyond the text', () => {
    expect(hitTest(linesOf('ab\ncd'), 9999, 9999)).toBe(5);
    expect(hitTest(linesOf('ab\ncd'), -50, -50)).toBe(0);
  });

  it('lands before the dropped space at the end of a wrapped line', () => {
    const lines = linesOf('aa bb', 2 * ADVANCE + SPACE_ADVANCE);
    expect(hitTest(lines, 99, 10)).toBe(2);
    expect(hitTest(lines, 1, LINE + 10)).toBe(3);
  });
});

describe('charUnder', () => {
  it('picks the glyph the point is inside, not the nearest gap', () => {
    expect(charUnder(linesOf('abcd'), 49, 10)).toBe(0);
    expect(charUnder(linesOf('abcd'), 51, 10)).toBe(1);
  });

  it('stays on the last glyph past the end of the line', () => {
    expect(charUnder(linesOf('abcd'), 9999, 10)).toBe(3);
  });
});

describe('selectionBoxes', () => {
  it('covers the glyphs between the two offsets', () => {
    expect(selectionBoxes(linesOf('abcd'), 1, 3)).toEqual([{ left: ADVANCE, right: 3 * ADVANCE, top: INK_TOP, height: INK }]);
  });

  it('is the same in both directions', () => {
    expect(selectionBoxes(linesOf('abcd'), 3, 1)).toEqual(selectionBoxes(linesOf('abcd'), 1, 3));
  });

  it('is empty when collapsed', () => {
    expect(selectionBoxes(linesOf('abcd'), 2, 2)).toEqual([]);
  });

  it('splits across lines', () => {
    expect(selectionBoxes(linesOf('ab\ncd'), 1, 4)).toEqual([
      { left: ADVANCE, right: 2 * ADVANCE, top: INK_TOP, height: INK },
      { left: 0, right: ADVANCE, top: LINE + INK_TOP, height: INK }
    ]);
  });
});

describe('moves', () => {
  it('goes down keeping the goal x', () => {
    expect(nextLine(linesOf('abcd\nef'), 3, Step.Forward, 3 * ADVANCE)).toBe(7);
  });

  it('goes to the start of the first line when pushed up', () => {
    expect(nextLine(linesOf('abcd\nef'), 3, Step.Back, 0)).toBe(0);
  });

  it('goes to the end of the last line when pushed down', () => {
    expect(nextLine(linesOf('abcd\nef'), 6, Step.Forward, 0)).toBe(7);
  });

  it('finds the edges of the current line', () => {
    const lines = linesOf('ab\ncd');
    expect(lineEdge(lines, 4, Step.Back)).toBe(3);
    expect(lineEdge(lines, 3, Step.Forward)).toBe(5);
    expect(lineRange(lines, 1)).toEqual([0, 2]);
  });
});

describe('trailing spaces', () => {
  it('advance the caret by a space each', () => {
    const lines = linesOf('ab  ');
    expect(caretRect(lines, 2).x).toBe(2 * ADVANCE);
    expect(caretRect(lines, 4).x).toBe(2 * ADVANCE + 2 * SPACE_ADVANCE);
  });

  it('stay put at a wrap, where the layout hides them', () => {
    const lines = linesOf('aa bb', 2 * ADVANCE + SPACE_ADVANCE);
    expect(caretRect(lines, 2).x).toBe(2 * ADVANCE);
  });
});

describe('edges of a wrapped line', () => {
  const lines = linesOf('aa bb', 2 * ADVANCE + SPACE_ADVANCE);

  it('ends before the space the wrap dropped, so End stays on the line', () => {
    expect(lineEdge(lines, 0, Step.Forward)).toBe(2);
    expect(caretRect(lines, lineEdge(lines, 0, Step.Forward)).top).toBe(INK_TOP);
  });

  it('selects the line without the dropped space', () => {
    expect(lineRange(lines, 0)).toEqual([0, 2]);
    expect(lineRange(lines, 4)).toEqual([3, 5]);
  });
});

describe('wordRange', () => {
  it('selects the word under the offset', () => {
    expect(wordRange('hello big world', 7)).toEqual([6, 9]);
  });

  it('selects the last word at the end of the text', () => {
    expect(wordRange('hello big', 9)).toEqual([6, 9]);
  });

  it('selects a run of punctuation as one word', () => {
    expect(wordRange('hi!!! you', 3)).toEqual([2, 5]);
  });
});

describe('offset units', () => {
  it('converts between code points and UTF-16 units around an astral character', () => {
    expect(unitsOf('a😀b', 2)).toBe(3);
    expect(codePointsOf('a😀b', 3)).toBe(2);
  });
});

describe('click grains', () => {
  const text = 'hello big world';
  const lines = linesOf(text);

  it('selects a word on the second click and a line on the third', () => {
    expect(pressed(Grain.Word, text, lines, 7)).toEqual({ anchor: 6, focus: 9 });
    expect(pressed(Grain.Line, text, lines, 7)).toEqual({ anchor: 0, focus: 15 });
  });

  it('extends by whole words while dragging forward and back', () => {
    const base = pressed(Grain.Word, text, lines, 7);
    expect(dragged(Grain.Word, text, lines, base, 12)).toEqual({ anchor: 6, focus: 15 });
    expect(dragged(Grain.Word, text, lines, base, 1)).toEqual({ anchor: 9, focus: 0 });
  });

  it('extends by characters when dragging from a plain click', () => {
    const base = pressed(Grain.Char, text, lines, 4);
    expect(dragged(Grain.Char, text, lines, base, 8)).toEqual({ anchor: 4, focus: 8 });
    expect(dragged(Grain.Char, text, lines, base, 1)).toEqual({ anchor: 4, focus: 1 });
  });
});

describe('laidAsTyped', () => {
  const collapsing: Flow = { spaces: Spaces.Collapse, wraps: true };

  it('accepts text the layout draws as typed', () => {
    expect(laidAsTyped('a b', 'a b', ['a b'], collapsing)).toBe(true);
    expect(laidAsTyped('a  b', 'a  b', ['a  b'], keep)).toBe(true);
  });

  it('refuses collapsing spaces, changed case and joined lines', () => {
    expect(laidAsTyped('a  b', 'a  b', ['a  b'], collapsing)).toBe(false);
    expect(laidAsTyped('ab', 'AB', ['AB'], keep)).toBe(false);
    expect(laidAsTyped('a\nb', 'a\nb', ['a\nb'], collapsing)).toBe(false);
  });
});
