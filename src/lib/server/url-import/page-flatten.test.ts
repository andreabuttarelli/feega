import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { flattened, layersOf } from './page-flatten';
import { stacksOf } from './page-stacks';
import { repeatedOf } from './repeated';

let n = 0;
const node = (type: string, x: number, y: number, width: number, height: number, more: Partial<RestNode> = {}): RestNode => ({ id: `n${n++}`, type, absoluteBoundingBox: { x, y, width, height }, ...more });
const frame = (name: string, box: [number, number, number, number], children: RestNode[], more: Partial<RestNode> = {}) => node('FRAME', ...box, { name, fills: [], children, ...more });
const text = (chars: string, box: [number, number, number, number]) => node('TEXT', ...box, { name: chars, characters: chars, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }] });
const red = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }];
const stack = (mode: string, more: Partial<RestNode> = {}): Partial<RestNode> => ({ layoutMode: mode, itemSpacing: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, ...more });

const page = (children: RestNode[]) => frame('Page', [0, 0, 1000, 1000], children);
const namesOf = (k: RestNode): string[] => [k.name ?? '', ...(k.children ?? []).flatMap(namesOf)];
const RAW = new Set(['div', 'span', 'stack', 'path', 'row', 'column', 'g']);

describe('flattened', () => {
  it('un involucro senza aspetto con un figlio della stessa misura sparisce', () => {
    const label = text('Products', [10, 10, 80, 20]);
    const made = flattened(page([frame('div', [10, 10, 80, 20], [frame('span', [10, 10, 80, 20], [label])])]));

    expect(made.children).toHaveLength(1);
    expect(made.children![0]).toMatchObject({ type: 'TEXT', characters: 'Products' });
  });

  it('un involucro dipinto resta', () => {
    const made = flattened(page([frame('div', [10, 10, 80, 20], [text('Go', [10, 10, 80, 20])], { fills: red })]));

    expect(made.children![0].type).toBe('FRAME');
  });

  it('il bottone tiene il bordo e il testo ci sta dentro diretto, col padding nel bottone', () => {
    const label = text('Products', [20, 14, 60, 20]);
    const button = node('INSTANCE', 10, 10, 80, 48, { name: 'Button', componentId: 'm1', fills: red, ...stack('HORIZONTAL', { paddingTop: 2, paddingLeft: 2 }), children: [frame('span', [12, 12, 76, 44], [frame('stack', [20, 14, 60, 20], [label])], stack('HORIZONTAL', { paddingTop: 2, paddingLeft: 8 }))] });
    const made = flattened(page([button])).children![0];

    expect(made).toMatchObject({ type: 'INSTANCE', componentId: 'm1', name: 'Button', paddingTop: 4, paddingLeft: 10 });
    expect(made.children).toHaveLength(1);
    expect(made.children![0]).toMatchObject({ type: 'TEXT', characters: 'Products' });
  });

  it('un’istanza non sparisce mai, nemmeno se non ha aspetto', () => {
    const made = flattened(page([frame('div', [0, 0, 50, 50], [node('INSTANCE', 0, 0, 50, 50, { name: 'Logo', componentId: 'm', fills: [], children: [node('RECTANGLE', 0, 0, 50, 50, { fills: red })] })])]));

    expect(made.children![0]).toMatchObject({ type: 'INSTANCE', componentId: 'm' });
  });

  it('le istanze di un componente restano della stessa forma, o il collegamento al principale si rompe', () => {
    const button = (x: number, inner: [number, number, number, number], tall = 20) =>
      node('INSTANCE', x, 0, 100, 40, { name: 'Button', componentId: 'main', fills: red, ...stack('HORIZONTAL'), children: [frame('span', [x, 0, 100, 40], [frame('span', inner, [text('Go', [inner[0] + 10, 10, 20, tall])])], stack('HORIZONTAL')), node('RECTANGLE', x, 0, 4, 4, { fills: red, layoutPositioning: 'ABSOLUTE' })] });
    const made = flattened(page([button(0, [0, 0, 100, 40]), button(200, [210, 5, 60, 70], 60)]));
    const shape = (k: RestNode): string => `${k.type}(${(k.children ?? []).map(shape).join(',')})`;

    expect(shape(made.children![0])).toBe(shape(made.children![1]));
  });

  it('ciò che è vuoto e invisibile se ne va', () => {
    const made = flattened(page([frame('div', [0, 0, 100, 100], []), node('RECTANGLE', 0, 0, 0, 10, { fills: red }), node('RECTANGLE', 0, 0, 10, 10), text('Keep', [0, 0, 40, 20])]));

    expect(made.children!.map((c) => c.type)).toEqual(['TEXT']);
  });

  it('un vuoto in una pila resta, perché occupa posto', () => {
    const made = flattened(page([frame('div', [0, 0, 100, 100], [frame('div', [0, 0, 100, 40], []), text('Keep', [0, 60, 40, 20])], stack('VERTICAL', { itemSpacing: 20 }))]));

    expect(made.children![0].children).toHaveLength(2);
  });

  it('icon > icon > path diventa un solo vettore', () => {
    const path = node('VECTOR', 0, 0, 24, 24, { name: 'path', fills: red, fillGeometry: [{ path: 'M0 0L24 24Z' }] });
    const made = flattened(page([node('GROUP', 0, 0, 24, 24, { name: 'icon', children: [node('GROUP', 0, 0, 24, 24, { name: 'icon', children: [path] })] })]));

    expect(made.children![0]).toMatchObject({ type: 'VECTOR', name: 'Icon' });
  });

  it('pile annidate nella stessa direzione e senza aspetto diventano una', () => {
    const kids = [text('A', [0, 0, 100, 20]), text('B', [0, 30, 100, 20]), text('C', [0, 60, 100, 20]), text('D', [0, 90, 100, 20])];
    const inner = frame('div', [0, 60, 100, 50], kids.slice(2), stack('VERTICAL', { itemSpacing: 10 }));
    const made = flattened(page([frame('Main', [0, 0, 100, 110], [...kids.slice(0, 2), inner], stack('VERTICAL', { itemSpacing: 10 }))])).children![0];

    expect(made.children!.map((c) => c.characters)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('nessun nome di tag grezzo, e un figlio non ripete il nome del padre', () => {
    const made = flattened(page([frame('nav', [0, 0, 300, 40], [frame('nav', [0, 0, 140, 40], [text('Home', [0, 0, 40, 20]), text('Docs', [60, 0, 40, 20])], { fills: red }), frame('div', [160, 0, 140, 40], [text('Login', [160, 0, 40, 20]), node('RECTANGLE', 220, 0, 20, 20, { fills: red })], { fills: red })], { fills: red })]));
    const names = namesOf(made);

    expect(names.filter((x) => RAW.has(x))).toEqual([]);
    expect(made.children![0].name).toBe('Nav');
    expect(made.children![0].children![0].name).not.toBe('Nav');
  });

  it('la home di vercel ha molti meno livelli e meno profondità', () => {
    const tree = JSON.parse(readFileSync(new URL('./fixtures/vercel.json', import.meta.url), 'utf8')) as PageTree;
    const root = repeatedOf(stacksOf(tree.root)).root;
    const [before, after] = [layersOf(root), layersOf(flattened(root))];

    expect(after.count).toBeLessThan(before.count * 0.9);
    expect(after.depth).toBeLessThan(before.depth);
    expect(namesOf(flattened(root)).filter((x) => RAW.has(x))).toEqual([]);
  });
});
