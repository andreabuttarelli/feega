import { describe, expect, it } from 'vitest';
import type { Pick } from '../messages';
import { ElementState } from '@feega/live-edit/element-state';
import { crumbsOf } from './crumbs';

const at = (line: number) => ({ file: 'a.svelte', line, col: 1 });
const pickWith = (names: string[]): Pick => ({ name: 'span', source: at(9), ancestors: names.map((name, i) => ({ name, source: at(i + 1) })) }) as unknown as Pick;

describe('crumbsOf', () => {
  it('a short chain is shown whole, root first, ending with the element', () => {
    expect(crumbsOf(pickWith(['section.hero', 'h1'])).map((c) => c.name)).toEqual(['section.hero', 'h1', 'span']);
  });

  it('a long chain is cut from the left with an ellipsis', () => {
    expect(crumbsOf(pickWith(['main', 'Hero', 'section', 'h1'])).map((c) => c.name)).toEqual(['…', 'section', 'h1', 'span']);
  });

  it('the ellipsis selects nothing', () => {
    expect(crumbsOf(pickWith(['main', 'Hero', 'section', 'h1']))[0].source).toBeNull();
  });

  it('the element carries the badge of the state forced on it, its ancestors none', () => {
    const crumbs = crumbsOf(pickWith(['section.hero']), 3, ElementState.Hover);

    expect(crumbs.map((c) => c.badge ?? '')).toEqual(['', ':hover']);
  });

  it('shows no badge on the default state', () => {
    expect(crumbsOf(pickWith(['section.hero']), 3, ElementState.Default).every((c) => !c.badge)).toBe(true);
  });
});
