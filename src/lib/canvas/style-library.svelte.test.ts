import { describe, expect, it } from 'vitest';
import { StyleKind } from '$lib/motion/styles-model';
import { StyleLibrary } from './style-library.svelte';

const HEADLINE = { kind: StyleKind.Text, size: 0.2, weight: 600 } as const;

describe('the canvas style library a person edits', () => {
  it('renaming moves the style under its new name and tells every frame', () => {
    const library = new StyleLibrary();
    const renamed: [string, string][] = [];
    library.styles = { Headline: HEADLINE, Body: { kind: StyleKind.Text, size: 0.05 } };
    library.connect({ push: () => {}, rename: (from, to) => renamed.push([from, to]) });

    library.rename('Headline', 'Display');

    expect(Object.keys(library.styles)).toEqual(['Body', 'Display']);
    expect(renamed).toEqual([['Headline', 'Display']]);
  });

  it('refuses a name that is taken, invalid or the same one', () => {
    const library = new StyleLibrary();
    const renamed: string[] = [];
    library.styles = { A: HEADLINE, B: HEADLINE };
    library.connect({ push: () => {}, rename: (from) => renamed.push(from) });

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
    library.connect({ push: (name, style) => pushed.push([name, style]), rename: () => {} });

    library.push('Headline', { ...HEADLINE, size: 0.3 });

    expect(library.styles.Headline).toMatchObject({ size: 0.3 });
    expect(pushed).toEqual([['Headline', { ...HEADLINE, size: 0.3 }]]);
  });
});
