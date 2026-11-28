import { describe, expect, it } from 'vitest';
import type { ComponentRow } from '../host/component-list';
import { componentFocus } from './components';

const row = (name: string, folder: string, uses = 0): ComponentRow => ({ name, folder, file: `src/${folder}/${name}.svelte`, uses });

const rows = [row('Button', 'lib/ui', 4)];

describe('componentFocus', () => {
  it('opens the component alone, from the top of its file', () => {
    expect(componentFocus(rows[0])).toEqual({ name: 'Button', source: { file: 'src/lib/ui/Button.svelte', line: 1, col: 1 }, index: 0, usage: null, alone: true });
  });
});
