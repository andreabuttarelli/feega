import { describe, expect, it } from 'vitest';
import { codeSets, withComponents } from './code-sets';
import type { RestNode } from '$lib/server/figma/rest-message';

const button = (props: Record<string, string | number | boolean>) => ({ component: 'Button', props });

describe('codeSets', () => {
  it('una prop a pochi valori simbolici diventa asse di variante, il testo diventa testo', () => {
    const sets = codeSets([button({ variant: 'outline', children: 'Save' }), button({ variant: 'ghost', children: 'Cancel' }), button({ children: 'Open' })]);

    expect(sets.map((s) => s?.variant)).toEqual([{ variant: 'outline' }, { variant: 'ghost' }, { variant: 'Default' }]);
    expect(sets.map((s) => s?.texts)).toEqual([{ children: 'Save' }, { children: 'Cancel' }, { children: 'Open' }]);
  });

  it('due usi con la stessa combinazione condividono la chiave, combinazioni diverse no', () => {
    const [a, b, c] = codeSets([button({ size: 'sm' }), button({ size: 'sm' }), button({ size: 'lg' })]);

    expect(a!.key).toBe(b!.key);
    expect(a!.key).not.toBe(c!.key);
    expect(a!.name).toBe('Button');
  });

  it('i booleani sono assi, className, handler e numeri no', () => {
    const [set] = codeSets([button({ disabled: true, className: 'mt-2', onClick: 'x', size: 16, 'aria-label': 'go' })]);

    expect(set!.variant).toEqual({ disabled: 'true' });
    expect(set!.texts).toEqual({});
  });

  it('una prop stringa con frasi non è un asse ma un testo', () => {
    const [set] = codeSets([{ component: 'CardTitle', props: { title: 'Total revenue' } }]);

    expect(set!.variant).toEqual({});
    expect(set!.texts).toEqual({ title: 'Total revenue' });
  });

  it('una prop con parole maiuscole è un testo anche se i valori sono pochi', () => {
    const [set] = codeSets([{ component: 'MenuButton', props: { tooltip: 'Dashboard' } }]);

    expect(set!.texts).toEqual({ tooltip: 'Dashboard' });
  });

  it('oltre il tetto di varianti per insieme gli usi in più restano livelli semplici', () => {
    const grid = Array.from({ length: 8 }, (_, a) => Array.from({ length: 8 }, (_, b) => ({ component: 'Chip', props: { tone: `t${a}`, size: `s${b}` } as Record<string, string | boolean> }))).flat();
    const uses = [...grid, ...grid.slice(0, 8).map((u) => ({ ...u, props: { ...u.props, loud: true } }))];
    const sets = codeSets(uses);

    expect(new Set(sets.filter(Boolean).map((s) => s!.key)).size).toBe(64);
    expect(sets.filter((s) => s === null).length).toBe(8);
  });
});

describe('withComponents', () => {
  it('sostituisce il segno d\'uso col componente, e toglie i segni che non diventano componenti', () => {
    const root: RestNode = { id: '1', type: 'FRAME', children: [{ id: '2', type: 'FRAME', use: 0 }, { id: '3', type: 'FRAME', use: 1 }] };
    const made = withComponents(root, [{ key: 'Button|{}', name: 'Button', variant: {}, texts: {} }, null]);

    expect(made.children![0]).toMatchObject({ codeComponent: { name: 'Button' } });
    expect(made.children![0]).not.toHaveProperty('use');
    expect(made.children![1]).not.toHaveProperty('use');
    expect(made.children![1]).not.toHaveProperty('codeComponent');
  });
});
