import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import { repeatedOf } from './repeated';

const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

let ids = 0;
const id = () => `n${++ids}`;

const text = (characters: string, x: number, y: number): RestNode => ({ id: id(), type: 'TEXT', name: characters, characters, absoluteBoundingBox: { x, y, width: 80, height: 20 }, fills: [{ type: 'SOLID', color: BLACK }], style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400 } });

const card = (title: string, x: number, image: string): RestNode => ({
  id: id(),
  type: 'FRAME',
  name: 'article',
  absoluteBoundingBox: { x, y: 100, width: 200, height: 240 },
  fills: [{ type: 'SOLID', color: WHITE }],
  children: [{ id: id(), type: 'RECTANGLE', name: 'image', absoluteBoundingBox: { x, y: 100, width: 200, height: 120 }, fills: [{ type: 'IMAGE', imageRef: image }] }, text(title, x + 10, 230), text('Read more', x + 10, 260)]
});

const button = (label: string, x: number, colour: typeof BLUE): RestNode => ({ id: id(), type: 'FRAME', name: 'a', absoluteBoundingBox: { x, y: 20, width: 120, height: 40 }, fills: [{ type: 'SOLID', color: colour }], cornerRadius: 6, children: [text(label, x + 20, 30)] });

const page = (children: RestNode[]): RestNode => ({ id: id(), type: 'FRAME', name: 'Page', absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 800 }, fills: [{ type: 'SOLID', color: WHITE }], children });

describe('repeatedOf', () => {
  it('tre card uguali con testi e immagini diversi diventano un componente con tre occorrenze', () => {
    const found = repeatedOf(page([card('One', 0, 'https://a/1.png'), card('Two', 220, 'https://a/2.png'), card('Three', 440, 'https://a/3.png')]));

    expect(found.components).toHaveLength(1);
    expect(found.components[0].name).toBe('Card');
    expect(found.components[0].variants).toHaveLength(1);
    expect(found.components[0].variants[0].occurrences).toBe(3);
  });

  it('ogni occorrenza punta alla prima, che è il main', () => {
    const { root } = repeatedOf(page([card('One', 0, 'https://a/1.png'), card('Two', 220, 'https://a/2.png')]));

    const [main, other] = root.children!;
    expect(main.type).toBe('INSTANCE');
    expect(main.componentId).toBe(main.id);
    expect(other.componentId).toBe(main.id);
  });

  it('due bottoni con lo stesso scheletro e colori diversi sono varianti dello stesso componente', () => {
    const found = repeatedOf(page([button('Start', 0, BLUE), button('Docs', 140, BLACK), button('Sign up', 280, BLUE)]));

    expect(found.components).toHaveLength(1);
    expect(found.components[0].name).toBe('Button');
    expect(found.components[0].variants.map((v) => v.occurrences).sort()).toEqual([1, 2]);
  });

  it('un nodo che compare una volta sola, o troppo piccolo, resta com è', () => {
    const tiny = (x: number): RestNode => ({ id: id(), type: 'FRAME', name: 'span', absoluteBoundingBox: { x, y: 0, width: 6, height: 6 }, fills: [{ type: 'SOLID', color: BLUE }], children: [{ id: id(), type: 'RECTANGLE', absoluteBoundingBox: { x, y: 0, width: 4, height: 4 }, fills: [{ type: 'SOLID', color: BLACK }] }] });
    const found = repeatedOf(page([card('Alone', 0, 'https://a/1.png'), tiny(300), tiny(320)]));

    expect(found.components).toHaveLength(0);
    expect(found.root.children!.every((c) => c.type !== 'INSTANCE')).toBe(true);
  });

  it('una riga in auto layout con un gruppo dentro diventa componente', () => {
    const row = (x: number): RestNode => {
      const icon: RestNode = { id: id(), type: 'GROUP', name: 'icon', absoluteBoundingBox: { x, y: 0, width: 16, height: 16 }, children: [{ id: id(), type: 'VECTOR', absoluteBoundingBox: { x, y: 0, width: 16, height: 16 }, fills: [{ type: 'SOLID', color: BLACK }] }, { id: id(), type: 'VECTOR', absoluteBoundingBox: { x, y: 0, width: 8, height: 8 }, fills: [{ type: 'SOLID', color: BLACK }] }] };
      return { id: id(), type: 'FRAME', name: 'a', layoutMode: 'HORIZONTAL', absoluteBoundingBox: { x, y: 0, width: 160, height: 28 }, fills: [{ type: 'SOLID', color: WHITE }], children: [icon, text('Inbox', x + 24, 4)] };
    };

    expect(repeatedOf(page([row(0), row(200)])).components).toHaveLength(1);
  });

  it('un componente dentro un altro non diventa un secondo componente', () => {
    const withButton = (x: number): RestNode => {
      const base = card('Card', x, 'https://a/1.png');
      return { ...base, children: [...base.children!, button('Go', x + 10, BLUE)] };
    };
    const found = repeatedOf(page([withButton(0), withButton(220)]));

    expect(found.components.map((c) => c.name)).toEqual(['Card']);
  });

  it('buttons of the same style and different heights are Size variants of one set', () => {
    const tall = (label: string, x: number): RestNode => ({ ...button(label, x, BLUE), absoluteBoundingBox: { x, y: 20, width: 160, height: 56 } });
    const { root, components } = repeatedOf(page([button('Start', 0, BLUE), button('Go', 140, BLUE), tall('Buy', 280), tall('Try', 460), button('Docs', 640, BLACK), button('Help', 780, BLACK)]));

    expect(components).toHaveLength(1);
    expect(new Set(root.children!.map((c) => c.name))).toEqual(new Set(['Button / Style=Primary, Size=Small', 'Button / Style=Primary, Size=Large', 'Button / Style=Secondary, Size=Small', 'Button']));
  });

  it('only buttons and links split by height: logos of many heights stay one main without a Size', () => {
    const logo = (x: number, height: number): RestNode => ({ id: id(), type: 'FRAME', name: 'div', absoluteBoundingBox: { x, y: 400, width: 100, height }, children: [{ id: id(), type: 'RECTANGLE', name: 'img', absoluteBoundingBox: { x, y: 400, width: 100, height }, fills: [{ type: 'IMAGE', imageRef: `https://a/${x}.png` }] }, { id: id(), type: 'VECTOR', absoluteBoundingBox: { x, y: 400, width: 10, height: 10 }, fills: [{ type: 'SOLID', color: BLACK }] }] });
    const { root } = repeatedOf(page([logo(0, 20), logo(120, 28), logo(240, 36), logo(360, 44)]));

    expect(root.children!.map((c) => c.name).filter((n) => n?.includes('Size'))).toEqual([]);
  });
});
