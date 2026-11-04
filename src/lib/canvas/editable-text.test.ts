// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TypingBurst, autoList, lineMove, offsetOf, pointAt, select, selectionIn, textOf } from './editable-text';
import { textBody, TextBodyFor } from '@feega/motion-core/motion/hyperframes/text-body';
import { ListKind } from '@feega/motion-core/motion/text-lists';

function editor(text: string, lists = [null, { kind: ListKind.Bullet, level: 0 }, null]) {
  const root = document.createElement('div');
  root.innerHTML = textBody(
    {
      p: { text, size: 0.05, font: 'Inter', runs: [{ start: 2, end: 4, weight: 700 }], lists, paragraphSpacing: 0, paragraphIndent: 0 },
      text: { id: null, lines: (t) => t.split('\n') },
      color: (v) => v,
      asset: () => null,
      font: (f) => f,
      weight: (_, w) => w
    },
    TextBodyFor.Editor
  );
  document.body.replaceChildren(root);
  return root;
}

describe('the editable text maps the DOM to the text model', () => {
  it('reads paragraphs without list markers or empty-line fillers', () => {
    expect(textOf(editor('Alpha\nBeta\n\nGamma', []))).toBe('Alpha\nBeta\n\nGamma');
    expect(textOf(editor('Alpha\nBeta\nGamma'))).toBe('Alpha\nBeta\nGamma');
  });

  it('puts the caret back where the model offset says, across runs and markers', () => {
    const root = editor('Alpha\nBeta\nGamma');
    for (let offset = 0; offset <= 'Alpha\nBeta\nGamma'.length; offset++) {
      const point = pointAt(root, offset);
      expect(offsetOf(root, point.node, point.offset)).toBe(offset);
    }
  });

  it('places the caret inside an empty paragraph', () => {
    const root = editor('A\n\nB', []);
    const point = pointAt(root, 2);
    expect(offsetOf(root, point.node, point.offset)).toBe(2);
    expect(root.children[1].contains(point.node)).toBe(true);
  });

  it('round-trips a selection', () => {
    const root = editor('Alpha\nBeta\nGamma');
    select(root, { start: 3, end: 9 });
    expect(selectionIn(root)).toEqual({ start: 3, end: 9 });
  });

  it('reads a paragraph the browser split into loose nodes', () => {
    const root = editor('Alpha\nBeta', []);
    root.append(document.createTextNode('!'));
    expect(textOf(root)).toBe('Alpha\nBeta!');
  });
});

describe('Home and End move the caret on every platform', () => {
  it('End collapses to the line end, Home to the line start', () => {
    expect(lineMove({ key: 'End', shiftKey: false })).toEqual({ alter: 'move', direction: 'forward' });
    expect(lineMove({ key: 'Home', shiftKey: false })).toEqual({ alter: 'move', direction: 'backward' });
  });

  it('with Shift they extend the selection', () => {
    expect(lineMove({ key: 'End', shiftKey: true })).toEqual({ alter: 'extend', direction: 'forward' });
  });

  it('other keys are left to the browser', () => {
    expect(lineMove({ key: 'ArrowRight', shiftKey: false })).toBeNull();
  });
});

describe('undo while typing goes back a word, not a letter', () => {
  const typeAll = (burst: TypingBurst, text: string, at = 0) => [...text].map((ch, i) => burst.starts('insertText', ch, at + i * 50));

  it('a word typed in one go is one step; the space before the next word opens another', () => {
    const steps = typeAll(new TypingBurst(), 'Hello world');

    expect(steps.filter(Boolean)).toHaveLength(2);
    expect(steps[5]).toBe(true);
  });

  it('a pause opens a new step, and so does switching from typing to deleting', () => {
    const burst = new TypingBurst();
    burst.starts('insertText', 'a', 0);

    expect(burst.starts('insertText', 'b', 5000)).toBe(true);
    expect(burst.starts('deleteContentBackward', null, 5050)).toBe(true);
    expect(burst.starts('deleteContentBackward', null, 5100)).toBe(false);
  });

  it('a cut ends the burst, so the next key is its own step', () => {
    const burst = new TypingBurst();
    burst.starts('insertText', 'a', 0);
    burst.cut();

    expect(burst.starts('insertText', 'b', 10)).toBe(true);
  });
});

describe('"- " and "1. " start a list, as in Figma', () => {
  it('a dash and a space at the start of a paragraph make a bullet list', () => {
    expect(autoList('one\n-', 5)).toEqual({ kind: ListKind.Bullet, cut: { start: 4, end: 5 } });
  });

  it('"1." and a space make a numbered list', () => {
    expect(autoList('1.', 2)).toEqual({ kind: ListKind.Number, cut: { start: 0, end: 2 } });
  });

  it('a dash inside a sentence stays a dash', () => {
    expect(autoList('a -', 3)).toBeNull();
  });
});
