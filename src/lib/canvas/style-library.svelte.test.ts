import { describe, expect, it } from 'vitest';
import { StyleKind } from '@feega/motion-core/motion/styles-model';
import { StyleLibrary } from './style-library.svelte';
import type { LibraryStore } from './project-library-store';
import { LibraryOp, type LibraryAsk } from '$lib/motion/project-library-ops';

const HEADLINE = { kind: StyleKind.Text, size: 0.2, weight: 600 } as const;

describe('the canvas style library a person edits', () => {
  it('renaming moves the style under its new name and tells every frame', () => {
    const library = new StyleLibrary();
    const renamed: [string, string][] = [];
    library.styles = { Headline: HEADLINE, Body: { kind: StyleKind.Text, size: 0.05 } };
    library.connect({ push: () => {}, rename: (from, to) => renamed.push([from, to]), remove: () => {} });

    library.rename('Headline', 'Display');

    expect(Object.keys(library.styles)).toEqual(['Body', 'Display']);
    expect(renamed).toEqual([['Headline', 'Display']]);
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

    expect(library.styles.Headline).toEqual(HEADLINE);
    expect(library.styles.Body).toMatchObject({ size: 0.05 });
    expect(sent).toEqual([{ op: LibraryOp.Adopt, entries: { Body: { kind: StyleKind.Text, size: 0.05 } } }]);
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
});
