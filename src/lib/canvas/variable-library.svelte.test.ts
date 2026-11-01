import { describe, expect, it, vi } from 'vitest';
import { VarType, type Collection } from '@feega/motion-core/motion/variables-model';
import { VariableLibrary } from './variable-library.svelte';
import type { LibraryStore } from './project-library-store';
import { LibraryOp, type LibraryAsk } from '$lib/motion/project-library-ops';

const THEME: Collection = { modes: ['Light'], vars: { surface: { type: VarType.Colour, values: { Light: '#ffffff' } } } };
const BRAND: Collection = { modes: ['Default'], vars: { ink: { type: VarType.Colour, values: { Default: '#111111' } } } };

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

function store(saved: Record<string, unknown>, fail = false) {
  const sent: LibraryAsk[] = [];
  const backend: LibraryStore = {
    load: async () => saved,
    send: async (ask) => {
      sent.push(ask);
      return !fail;
    }
  };
  return { backend, sent };
}

describe('the project variables library', () => {
  it('opens on the collections saved for the project', async () => {
    const library = new VariableLibrary();
    await library.open(store({ Theme: THEME }).backend);
    expect(library.collections).toEqual({ Theme: THEME });
  });

  it('a collection found only in a frame is adopted into the project, without its active mode', async () => {
    const library = new VariableLibrary();
    const { backend, sent } = store({ Theme: THEME });
    library.connect({ push: vi.fn(), remove: vi.fn() });
    await library.open(backend);

    library.found({ Theme: THEME, Brand: { ...BRAND, active: 'Default' } });

    expect(library.collections.Brand).toEqual(BRAND);
    expect(sent).toEqual([{ op: LibraryOp.Adopt, entries: { Brand: BRAND } }]);
  });

  it('a frame holding an older copy is brought up to date, its own mode aside', async () => {
    const push = vi.fn();
    const library = new VariableLibrary();
    library.connect({ push, remove: vi.fn() });
    await library.open(store({ Theme: THEME }).backend);

    library.found({ Theme: { ...THEME, active: 'Light' } });
    expect(push).not.toHaveBeenCalled();

    library.found({ Theme: { modes: ['Light'], vars: {} } });
    expect(push).toHaveBeenCalledWith('Theme', THEME);
  });

  it('an edit is saved to the project and rolls back when the save fails', async () => {
    const push = vi.fn();
    const library = new VariableLibrary();
    library.connect({ push, remove: vi.fn() });
    const { backend, sent } = store({ Theme: THEME }, true);
    await library.open(backend);

    await library.push('Theme', BRAND);

    expect(sent[0]).toEqual({ op: LibraryOp.Save, name: 'Theme', value: BRAND });
    expect(library.collections.Theme).toEqual(THEME);
    expect(push).toHaveBeenLastCalledWith('Theme', THEME);
  });

  it('removing a variable saves the collection without it', async () => {
    const library = new VariableLibrary();
    library.connect({ push: vi.fn(), remove: vi.fn() });
    const { backend, sent } = store({ Theme: THEME });
    await library.open(backend);

    await library.remove('Theme', 'surface');

    expect(sent).toEqual([{ op: LibraryOp.Save, name: 'Theme', value: { modes: ['Light'], vars: {} } }]);
  });
});
