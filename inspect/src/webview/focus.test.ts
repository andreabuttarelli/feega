import { describe, expect, it } from 'vitest';
import type { Pick, Source } from '../messages';
import { FocusKey, Scheme, focusKeyOf, focusOf, rowFocus, schemeApplyOf, schemeOf, snapshotNoticeOf, stepZoom, themeOfScheme, wheelFactor } from './focus';

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
    expect(focusKeyOf('f', { open: false, available: true })).toBe(FocusKey.Enter);
  });

  it('leaves on Escape while a component is open, on either tab', () => {
    expect(focusKeyOf('Escape', { open: true, available: true })).toBe(FocusKey.Exit);
  });

  it('leaves F alone while focused, so the tab is not closed by a stray key', () => {
    expect(focusKeyOf('F', { open: true, available: true })).toBeNull();
  });

  it('leaves Escape alone when not focused', () => {
    expect(focusKeyOf('Escape', { open: false, available: true })).toBeNull();
  });

  it('ignores F when nothing can be focused', () => {
    expect(focusKeyOf('f', { open: false, available: false })).toBeNull();
  });
});

describe('snapshotNoticeOf', () => {
  it.each([
    ['turbopack', undefined, 'Snapshot: Turbopack cannot mount components'],
    ['mount_error', 'provider', 'Snapshot: needs a provider or context'],
    ['mount_error', 'not_exported', 'Snapshot: the component is not exported'],
    ['mount_error', 'load', 'Snapshot: its module failed to load'],
    ['mount_error', 'other', 'Static copy: this component cannot run on its own'],
    ['mount_error', undefined, 'Static copy: this component cannot run on its own'],
    ['no_adapter', undefined, 'Snapshot: the dev server has no Feega mount page'],
    ['timeout', undefined, 'Snapshot: it rendered nothing in time'],
    ['unsupported_framework', undefined, 'Snapshot: this framework cannot mount alone']
  ])('labels %s %s', (reason, detail, label) => {
    expect(snapshotNoticeOf(reason, detail)).toBe(label);
  });

  it('says nothing for a reason it does not know', () => {
    expect(snapshotNoticeOf('/Users/me/secret.tsx failed')).toBeNull();
  });

  it('says nothing when there is no reason', () => {
    expect(snapshotNoticeOf(null)).toBeNull();
  });
});

describe('the light and dark switch', () => {
  const themes = [{ name: 'default' }, { name: 'dark' }, { name: 'sepia' }] as never[];

  it('is not offered when the project has no dark theme', () => {
    expect(themeOfScheme([{ name: 'default' }, { name: 'sepia' }] as never[], Scheme.Dark)).toBeNull();
  });

  it('switches to the dark theme of the project, and back to the default', () => {
    expect(themeOfScheme(themes, Scheme.Dark)).toBe('dark');
    expect(themeOfScheme(themes, Scheme.Light)).toBe('default');
  });

  it('reads the scheme from the theme that is on', () => {
    expect(schemeOf(themes, 'dark')).toBe(Scheme.Dark);
    expect(schemeOf(themes, 'default')).toBe(Scheme.Light);
    expect(schemeOf(themes, 'sepia')).toBe(Scheme.Light);
  });

  it('matches names like Dark mode or night', () => {
    expect(themeOfScheme([{ name: 'default' }, { name: 'Dark Mode' }] as never[], Scheme.Dark)).toBe('Dark Mode');
  });
});

describe('the switch without a dark theme', () => {
  const themes = [{ name: 'default', apply: { kind: 'default', target: 'html', value: '' } }, { name: 'sepia', apply: { kind: 'class', target: 'html', value: 'sepia' } }] as never[];

  it('emulates the dark color scheme in the focus tab', () => {
    expect(schemeApplyOf(themes, 'default', Scheme.Dark)).toEqual({ kind: 'media', target: 'html', value: 'dark' });
  });

  it('leaves the theme that is on when the scheme is light', () => {
    expect(schemeApplyOf(themes, 'sepia', Scheme.Light)).toEqual({ kind: 'class', target: 'html', value: 'sepia' });
    expect(schemeApplyOf(themes, 'default', Scheme.Light)).toEqual({ kind: 'default', target: 'html', value: '' });
  });

  it('uses the project dark theme when there is one', () => {
    const withDark = [...themes, { name: 'dark', apply: { kind: 'class', target: 'html', value: 'dark' } }] as never[];

    expect(schemeApplyOf(withDark, 'dark', Scheme.Dark)).toEqual({ kind: 'class', target: 'html', value: 'dark' });
  });
});

describe('zoom', () => {
  it('steps through round values', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(0.1, -1)).toBe(0.1);
    expect(stepZoom(8, 1)).toBe(8);
  });

  it('turns a wheel delta into a factor, down zooms out', () => {
    expect(wheelFactor(-10)).toBeGreaterThan(1);
    expect(wheelFactor(10)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
  });
});
