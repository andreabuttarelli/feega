import { describe, expect, it, vi } from 'vitest';
import { VarType, type Collection } from '@feega/motion-core/motion/variables-model';
import { VariableLibrary } from './variable-library.svelte';

const THEME: Collection = { modes: ['Light'], vars: { surface: { type: VarType.Colour, values: { Light: '#ffffff' } } } };

describe('the variables library of a canvas', () => {
  it('pushing a collection keeps it and tells the canvas', () => {
    const push = vi.fn();
    const library = new VariableLibrary();
    library.connect({ push, remove: vi.fn() });
    library.push('Theme', THEME);
    expect(library.collections.Theme).toEqual(THEME);
    expect(push).toHaveBeenCalledWith('Theme', THEME);
  });

  it('removing a variable tells the canvas and drops it from the kept collection', () => {
    const remove = vi.fn();
    const library = new VariableLibrary();
    library.connect({ push: vi.fn(), remove });
    library.push('Theme', THEME);
    library.remove('Theme', 'surface');
    expect(remove).toHaveBeenCalledWith('Theme', 'surface');
    expect(library.collections.Theme.vars.surface).toBeUndefined();
  });
});
