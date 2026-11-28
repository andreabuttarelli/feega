import { describe, expect, it } from 'vitest';
import type { ComponentRow } from '../host/component-list';
import { componentKeysOf, forgetPages, pageKeysOf } from './canvas-stale';
import { CANVAS_COLUMNS, layoutCanvas } from './canvas-layout';

const frames = layoutCanvas(
  [
    { route: '/', dynamic: false },
    { route: '/about', dynamic: false }
  ],
  CANVAS_COLUMNS
).frames;

describe('pageKeysOf', () => {
  it('takes every size of the page whose route file changed', () => {
    expect(pageKeysOf(frames, ['src/routes/about/+page.svelte'])).toEqual(['/about::desktop', '/about::tablet', '/about::phone']);
  });

  it('takes the home page for the root route file', () => {
    expect(pageKeysOf(frames, ['src/routes/+page.svelte']).every((key) => key.startsWith('/::'))).toBe(true);
  });

  it('leaves the pages alone when a file that is not a route changed', () => {
    expect(pageKeysOf(frames, ['src/lib/Card.svelte'])).toEqual([]);
  });
});

describe('forgetPages', () => {
  const store = () => new Map([['/::desktop', 1], ['/about::desktop', 2], ['/about::phone', 3]]);

  it('drops every size of a page whose file changed while the canvas was closed', () => {
    const kept = store();

    forgetPages(kept, ['src/routes/about/+page.svelte']);

    expect([...kept.keys()]).toEqual(['/::desktop']);
  });

  it('keeps everything when the file is not a route', () => {
    const kept = store();

    forgetPages(kept, ['src/lib/Card.svelte']);

    expect(kept.size).toBe(3);
  });
});

describe('componentKeysOf', () => {
  const rows: ComponentRow[] = [
    { name: 'Card', file: 'src/lib/Card.svelte', folder: 'lib', uses: 0, examples: [] },
    { name: 'Button', file: 'src/lib/Button.svelte', folder: 'lib', uses: 0, examples: [] }
  ];

  it('takes the component whose file changed', () => {
    expect(componentKeysOf(rows, ['src/lib/Card.svelte'])).toEqual(['src/lib/Card.svelte::Card']);
  });

  it('takes nothing for other files', () => {
    expect(componentKeysOf(rows, ['src/routes/+page.svelte'])).toEqual([]);
  });
});
