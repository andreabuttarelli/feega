import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StyleKind } from '@feega/motion-core/motion/styles-model';
import { StyleLibrary } from './style-library.svelte';
import type { LibraryStore } from './project-library-store';
import { LibraryOp, type LibraryAsk } from '$lib/motion/project-library-ops';

const HEADLINE = { kind: StyleKind.Text, size: 0.2, weight: 600 } as const;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the canvas style library a person edits', () => {
  it('renaming moves the style under its new name and tells every frame', () => {
    const library = new StyleLibrary();
    const renamed: [string, string][] = [];
    library.styles = { Headline: HEADLINE, Body: { kind: StyleKind.Text, size: 0.05 } };
    library.connect({ push: () => {}, rename: (from, to) => renamed.push([from, to]), remove: () => {} });

    library.rename('Headline', 'Display');

    expect(Object.keys(library.styles)).toEqual(['Display', 'Body']);
    expect(renamed).toEqual([['Headline', 'Display']]);
  });

  it('a name with / puts the style in a group', () => {
    const library = new StyleLibrary();
    library.styles = { Primary: HEADLINE };

    library.rename('Primary', 'Brand / Primary');

    expect(Object.keys(library.styles)).toEqual(['Brand / Primary']);
  });

  it('refuses a name that is taken, invalid or the same one', () => {
    const library = new StyleLibrary();
    const renamed: string[] = [];
    library.styles = { A: HEADLINE, B: HEADLINE };
    library.connect({ push: () => {}, rename: (from) => renamed.push(from), remove: () => {} });

    library.rename('A', 'B');
    library.rename('A', 'A');
    library.rename('A', '!!');

    expect(Object.keys(library.styles)).toEqual(['A', 'B']);
    expect(renamed).toEqual([]);
  });

  it('an edit still holding the old name lands on the renamed style, never brings the old one back', () => {
    const library = new StyleLibrary();
    library.styles = { 'Colour 3': { kind: StyleKind.Colour, color: '#111111' } };

    library.rename('Colour 3', 'Accent');
    library.push('Colour 3', { kind: StyleKind.Colour, color: '#ff0000' });

    expect(library.styles).toEqual({ Accent: { kind: StyleKind.Colour, color: '#ff0000' } });
  });

  it('editing a text style reaches every frame', () => {
    const library = new StyleLibrary();
    const pushed: [string, unknown][] = [];
    library.styles = { Headline: HEADLINE };
    library.connect({ push: (name, style) => pushed.push([name, style]), rename: () => {}, remove: () => {} });

    library.push('Headline', { ...HEADLINE, size: 0.3 });

    expect(library.styles.Headline).toMatchObject({ size: 0.3 });
    expect(pushed).toEqual([['Headline', { ...HEADLINE, size: 0.3 }]]);
  });
});

function store(saved: Record<string, unknown>, fail = false) {
  const sent: LibraryAsk[] = [];
  const backend: LibraryStore = {
    load: async () => saved as never,
    send: async (ask) => {
      sent.push(ask);
      return !fail;
    }
  };
  return { backend, sent };
}

const sinkOf = (pushed: [string, unknown][], removed: string[] = []) => ({ push: (name: string, style: unknown) => pushed.push([name, style]), rename: () => {}, remove: (name: string) => removed.push(name) });

describe('the project style library', () => {
  it('opens on the styles saved for the project', async () => {
    const library = new StyleLibrary();
    await library.open(store({ Headline: HEADLINE }).backend);

    expect(library.styles).toEqual({ Headline: HEADLINE });
  });

  it('a style found only in a frame is adopted into the project, never overwriting one it has', async () => {
    const library = new StyleLibrary();
    const { backend, sent } = store({ Headline: HEADLINE });
    library.connect(sinkOf([]));
    await library.open(backend);

    library.found({ Headline: { kind: StyleKind.Text, size: 0.9 }, Body: { kind: StyleKind.Text, size: 0.05 } });
    await vi.runAllTimersAsync();

    expect(library.styles.Headline).toEqual(HEADLINE);
    expect(library.styles.Body).toMatchObject({ size: 0.05 });
    expect(sent).toEqual([{ op: LibraryOp.Adopt, entries: { Body: { kind: StyleKind.Text, size: 0.05 } } }]);
  });

  it('frames arriving one after another adopt their styles in one request', async () => {
    const library = new StyleLibrary();
    const { backend, sent } = store({});
    await library.open(backend);

    library.found({ A: HEADLINE });
    library.found({ A: HEADLINE, B: HEADLINE });
    await vi.runAllTimersAsync();

    expect(sent).toEqual([{ op: LibraryOp.Adopt, entries: { A: HEADLINE, B: HEADLINE } }]);
  });

  it('a frame holding an older copy of a project style is brought up to date', async () => {
    const library = new StyleLibrary();
    const pushed: [string, unknown][] = [];
    library.connect(sinkOf(pushed));
    await library.open(store({ Headline: HEADLINE }).backend);

    library.found({ Headline: { kind: StyleKind.Text, size: 0.9 } });

    expect(pushed).toEqual([['Headline', HEADLINE]]);
  });

  it('an edit shows at once, is saved to the project, and rolls back if the save fails', async () => {
    const library = new StyleLibrary();
    const pushed: [string, unknown][] = [];
    library.connect(sinkOf(pushed));
    const { backend, sent } = store({ Headline: HEADLINE }, true);
    await library.open(backend);

    const saving = library.push('Headline', { ...HEADLINE, size: 0.3 });
    expect(library.styles.Headline).toMatchObject({ size: 0.3 });
    await saving;

    expect(sent[0]).toEqual({ op: LibraryOp.Save, name: 'Headline', value: { ...HEADLINE, size: 0.3 } });
    expect(library.styles.Headline).toEqual(HEADLINE);
    expect(pushed.at(-1)).toEqual(['Headline', HEADLINE]);
    expect(library.failed).toBe(true);
  });

  it('removing a style takes it out of the project and detaches it everywhere', async () => {
    const library = new StyleLibrary();
    const removed: string[] = [];
    library.connect(sinkOf([], removed));
    const { backend, sent } = store({ Headline: HEADLINE });
    await library.open(backend);

    await library.remove('Headline');

    expect(library.styles).toEqual({});
    expect(removed).toEqual(['Headline']);
    expect(sent).toEqual([{ op: LibraryOp.Remove, name: 'Headline' }]);
  });
  it('a style the project stored with its keys in another order is the same style: no push, or every frame re-commits forever', async () => {
    const library = new StyleLibrary();
    const pushed: [string, unknown][] = [];
    library.connect(sinkOf(pushed));
    await library.open(store({ Headline: { weight: 600, size: 0.2, kind: StyleKind.Text } }).backend);

    library.found({ Headline: HEADLINE });
    library.found({ Headline: HEADLINE });

    expect(pushed).toEqual([]);
  });
});

describe('a style changed right after it was made', () => {
  it('reaches the project in the order it was made: the rename waits for the save', async () => {
    const library = new StyleLibrary();
    const sent: LibraryAsk[] = [];
    const answers: (() => void)[] = [];
    const backend: LibraryStore = {
      load: async () => ({}),
      send: (ask) => {
        sent.push(ask);
        return new Promise<boolean>((resolve) => answers.push(() => resolve(true)));
      }
    };
    library.connect(sinkOf([]));
    await library.open(backend);

    const saving = library.push('Colour 1', { kind: StyleKind.Colour, color: '#111111' });
    const renaming = library.rename('Colour 1', 'Danger');
    await Promise.resolve();

    expect(sent.map((ask) => ask.op)).toEqual([LibraryOp.Save]);
    answers[0]();
    await saving;
    await Promise.resolve();
    expect(sent.map((ask) => ask.op)).toEqual([LibraryOp.Save, LibraryOp.Rename]);
    answers[1]();
    await renaming;
    expect(Object.keys(library.styles)).toEqual(['Danger']);
  });
});

describe('a canvas with no project, like a shared link', () => {
  it('styles already known are not written again, or the frame effect loops', () => {
    const library = new StyleLibrary();
    library.found({ Headline: HEADLINE });
    const before = library.styles;

    library.found({ Headline: HEADLINE });

    expect(library.styles).toBe(before);
  });
});
