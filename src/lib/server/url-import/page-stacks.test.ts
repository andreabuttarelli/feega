import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { absoluteShare, stacksOf } from './page-stacks';

let n = 0;
const node = (type: string, x: number, y: number, width: number, height: number, more: Partial<RestNode> = {}): RestNode => ({ id: `n${n++}`, type, absoluteBoundingBox: { x, y, width, height }, ...more });
const frame = (x: number, y: number, width: number, height: number, children: RestNode[], more: Partial<RestNode> = {}) => node('FRAME', x, y, width, height, { fills: [], children, ...more });
const rect = (x: number, y: number, width: number, height: number) => node('RECTANGLE', x, y, width, height);

const placed = (root: RestNode): Map<string, RestNode['absoluteBoundingBox']> => {
  const out = new Map<string, RestNode['absoluteBoundingBox']>();
  const walk = (k: RestNode) => {
    if (k.type !== 'FRAME' || !k.id.startsWith('stack:')) {
      out.set(k.id, k.absoluteBoundingBox);
    }
    (k.children ?? []).forEach(walk);
  };
  walk(root);
  return out;
};

describe('stacksOf', () => {
  it('blocchi uno sotto l’altro diventano una pila verticale con gap e padding', () => {
    const made = stacksOf(frame(0, 0, 400, 300, [rect(20, 10, 360, 50), rect(20, 80, 360, 50), rect(20, 150, 360, 50)]));

    expect(made).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: 20, paddingTop: 10, paddingLeft: 20, counterAxisAlignItems: 'CENTER' });
  });

  it('due colonne affiancate diventano una pila orizzontale', () => {
    const made = stacksOf(frame(0, 0, 400, 100, [rect(0, 0, 180, 100), rect(220, 0, 180, 100)]));

    expect(made).toMatchObject({ layoutMode: 'HORIZONTAL', itemSpacing: 40 });
  });

  it('gap diversi annidano: titolo e testo vicini, blocchi lontani', () => {
    const made = stacksOf(frame(0, 0, 400, 400, [rect(0, 0, 400, 40), rect(0, 48, 400, 40), rect(0, 188, 400, 40), rect(0, 236, 400, 40)]));

    expect(made.layoutMode).toBe('VERTICAL');
    expect(made.itemSpacing).toBe(100);
    expect(made.children!.map((c) => c.layoutMode)).toEqual(['VERTICAL', 'VERTICAL']);
    expect(made.children!.map((c) => c.itemSpacing)).toEqual([8, 8]);
  });

  it('una griglia diventa righe orizzontali in una pila verticale', () => {
    const made = stacksOf(frame(0, 0, 300, 300, [rect(0, 0, 140, 140), rect(160, 0, 140, 140), rect(0, 160, 140, 140), rect(160, 160, 140, 140)]));

    expect(made.layoutMode).toBe('VERTICAL');
    expect(made.children!.map((c) => c.layoutMode)).toEqual(['HORIZONTAL', 'HORIZONTAL']);
  });

  it('ciò che si sovrappone resta assoluto', () => {
    const made = stacksOf(frame(0, 0, 300, 300, [rect(0, 0, 200, 200), rect(100, 100, 200, 200)]));

    expect(made.layoutMode).toBeUndefined();
  });

  it('i figli assoluti restano fuori dal flusso e la pila si forma sugli altri', () => {
    const made = stacksOf(frame(0, 0, 300, 300, [node('RECTANGLE', 0, 0, 300, 300, { layoutPositioning: 'ABSOLUTE' }), rect(0, 0, 300, 100), rect(0, 120, 300, 100)]));

    expect(made.layoutMode).toBe('VERTICAL');
    expect(made.children![0].layoutPositioning).toBe('ABSOLUTE');
  });

  it('un blocco largo quanto il contenitore lo riempie, così la tela si ridimensiona', () => {
    const made = stacksOf(frame(0, 0, 400, 300, [frame(0, 0, 400, 100, []), rect(100, 120, 200, 100)]));

    expect(made.children![0].layoutAlign).toBe('STRETCH');
  });

  it('una riga larga quanto la colonna la riempie e distribuisce, così si restringe con la tela', () => {
    const made = stacksOf(frame(0, 0, 1000, 400, [rect(100, 0, 800, 50), rect(110, 100, 200, 100), rect(450, 100, 100, 100), rect(700, 100, 200, 100)]));
    const row = made.children![1];

    expect(row).toMatchObject({ layoutMode: 'HORIZONTAL', primaryAxisAlignItems: 'SPACE_BETWEEN', layoutAlign: 'STRETCH', paddingLeft: 10 });
  });

  it('una pila che arriva già dalla pagina riempie coi figli larghi quanto lei', () => {
    const made = stacksOf(frame(0, 0, 400, 300, [frame(20, 0, 360, 100, []), rect(100, 120, 200, 100)], { layoutMode: 'VERTICAL', paddingLeft: 20, paddingRight: 20, itemSpacing: 20 }));

    expect(made.children![0].layoutAlign).toBe('STRETCH');
  });

  it('una riga stretta resta della sua misura', () => {
    const made = stacksOf(frame(0, 0, 1000, 400, [rect(100, 0, 800, 50), rect(100, 100, 100, 40), rect(220, 100, 100, 40)]));

    expect(made.children![1]).toMatchObject({ layoutMode: 'HORIZONTAL', primaryAxisAlignItems: 'MIN' });
    expect(made.children![1].layoutAlign).toBeUndefined();
  });

  it('una cornice con testi resta fissa: il motore ridimensionerebbe i testi', () => {
    const made = stacksOf(frame(0, 0, 400, 100, [node('TEXT', 0, 0, 100, 20, { characters: 'a' }), node('TEXT', 0, 30, 100, 20, { characters: 'b' })]));

    expect(made.layoutMode).toBeUndefined();
  });

  it('le icone vettoriali non diventano pile', () => {
    const made = stacksOf(node('GROUP', 0, 0, 24, 24, { children: [node('VECTOR', 0, 0, 10, 10), node('VECTOR', 14, 14, 10, 10)] }));

    expect(made.layoutMode).toBeUndefined();
  });

  it('nessun nodo cambia posto', () => {
    const before = frame(0, 0, 400, 400, [rect(10, 0, 100, 40), rect(30, 48, 200, 40), rect(0, 188, 50, 40), rect(300, 188, 50, 40)]);

    expect(placed(stacksOf(before))).toEqual(placed(before));
  });

  it.each(['stripe', 'linear', 'vercel'])('%s: meno nodi assoluti, nessuno spostato', (name) => {
    const tree = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as PageTree;
    const made = stacksOf(tree.root);

    expect(absoluteShare(made)).toBeLessThan(absoluteShare(tree.root));
    expect(placed(made)).toEqual(placed(tree.root));
  });
});
