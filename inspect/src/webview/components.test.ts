import { describe, expect, it } from 'vitest';
import type { ComponentRow } from '../host/component-list';
import { componentFocus, exampleLabel } from './components';

const row = (name: string, folder: string, uses = 0): ComponentRow => ({ name, folder, file: `src/${folder}/${name}.svelte`, uses, examples: [] });

const rows = [row('Button', 'lib/ui', 4)];

describe('componentFocus', () => {
  it('opens the component alone, from the top of its file', () => {
    expect(componentFocus(rows[0])).toEqual({ name: 'Button', source: { file: 'src/lib/ui/Button.svelte', line: 1, col: 1 }, index: 0, usage: null, alone: true });
  });
});

describe('exampleLabel', () => {
  it('names a usage by its parent folder, file and line', () => {
    expect(exampleLabel({ file: 'src/routes/wiki/[slug]/+page.svelte', line: 12 })).toBe('[slug]/+page.svelte:12');
  });

  it('keeps a file at the top as it is', () => {
    expect(exampleLabel({ file: 'App.vue', line: 3 })).toBe('App.vue:3');
  });
});
