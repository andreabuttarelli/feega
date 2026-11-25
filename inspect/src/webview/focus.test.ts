import { describe, expect, it } from 'vitest';
import type { Pick, Source } from '../messages';
import { FocusKey, focusKeyOf, focusOf, rowFocus } from './focus';

const CARD: Source = { file: 'src/components/ProductCard.tsx', line: 4, col: 5 };

const pick = (over: Partial<Pick> = {}) => ({ source: CARD, component: { file: 'src/App.tsx', line: 9, col: 3 }, instanceIndex: 1, ...over }) as Pick;

describe('focusOf', () => {
  it('names the focus after the file of the component', () => {
    expect(focusOf(pick())).toMatchObject({ name: 'ProductCard', source: CARD, index: 1 });
  });

  it('remembers where the instance is used, to write props back there', () => {
    expect(focusOf(pick({ usage: { index: 1, count: 2 } }))?.usage).toEqual({ at: { file: 'src/App.tsx', line: 9, col: 3 }, which: { index: 1, count: 2 } });
  });

  it('is nothing for an element that is not inside a component', () => {
    expect(focusOf(pick({ component: null }))).toBeNull();
  });

  it('names an Astro or Svelte file without its extension', () => {
    expect(focusOf(pick({ source: { file: 'src/lib/Hero.svelte', line: 1, col: 1 } }))?.name).toBe('Hero');
  });
});

describe('rowFocus', () => {
  const node = { name: 'ProductCard', source: CARD, component: true, count: 1, instance: 2 };

  it('focuses the instance the row stands for, the first one when it folds several', () => {
    expect(rowFocus(node)).toMatchObject({ name: 'ProductCard', source: CARD, index: 2 });
    expect(rowFocus({ ...node, count: 3 })).toMatchObject({ name: 'ProductCard', source: CARD, index: 2 });
  });

  it('does not know the usage of a row, which has no parent in the tree node', () => {
    expect(rowFocus(node)?.usage).toBeNull();
  });

  it('is nothing for a row that is not a component', () => {
    expect(rowFocus({ ...node, component: false })).toBeNull();
  });
});

describe('focusKeyOf', () => {
  it('enters on F when something can be focused and nothing is', () => {
    expect(focusKeyOf('f', { focused: false, available: true })).toBe(FocusKey.Enter);
  });

  it('leaves on Escape while focused', () => {
    expect(focusKeyOf('Escape', { focused: true, available: true })).toBe(FocusKey.Exit);
  });

  it('leaves F alone while focused, so the tab is not closed by a stray key', () => {
    expect(focusKeyOf('F', { focused: true, available: true })).toBeNull();
  });

  it('leaves Escape alone when not focused', () => {
    expect(focusKeyOf('Escape', { focused: false, available: true })).toBeNull();
  });

  it('ignores F when nothing can be focused', () => {
    expect(focusKeyOf('f', { focused: false, available: false })).toBeNull();
  });
});
