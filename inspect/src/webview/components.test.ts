import { describe, expect, it } from 'vitest';
import type { ComponentRow } from '../host/component-list';
import { componentFocus, groupComponents } from './components';

const row = (name: string, folder: string, uses = 0): ComponentRow => ({ name, folder, file: `src/${folder}/${name}.svelte`, uses });

const rows = [row('Button', 'lib/ui', 4), row('Card', 'lib'), row('Avatar', 'lib/ui'), row('Hero', '')];

describe('groupComponents', () => {
  it('groups by folder, folders and components in alphabetical order, the root group first', () => {
    const groups = groupComponents(rows, '');

    expect(groups.map((g) => g.folder)).toEqual(['', 'lib', 'lib/ui']);
    expect(groups[2].rows.map((r) => r.name)).toEqual(['Avatar', 'Button']);
  });

  it('filters by name, ignoring case, and drops the empty groups', () => {
    const groups = groupComponents(rows, 'BUT');

    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((r) => r.name)).toEqual(['Button']);
  });

  it('keeps a whole folder when the search matches its path', () => {
    expect(groupComponents(rows, 'lib/ui')[0].rows.map((r) => r.name)).toEqual(['Avatar', 'Button']);
  });

  it('has nothing when nothing matches', () => {
    expect(groupComponents(rows, 'zzz')).toEqual([]);
  });
});

describe('componentFocus', () => {
  it('opens the component alone, from the top of its file', () => {
    expect(componentFocus(rows[0])).toEqual({ name: 'Button', source: { file: 'src/lib/ui/Button.svelte', line: 1, col: 1 }, index: 0, usage: null, alone: true });
  });
});
