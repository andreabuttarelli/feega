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

  it('a button inside repeated cards is a Button instance inside the Card main, not lost in it', () => {
    const withButton = (x: number): RestNode => {
      const base = card('Card', x, 'https://a/1.png');
      return { ...base, children: [...base.children!, button('Go', x + 10, BLUE)] };
    };
    const found = repeatedOf(page([withButton(0), withButton(220)]));
    const [main, other] = found.root.children!;
    const buttonOf = (n: RestNode) => n.children!.find((c) => c.name?.startsWith('Button'))!;

    expect(found.components.map((c) => c.name)).toEqual(['Card', 'Button']);
    expect(buttonOf(main).type).toBe('INSTANCE');
    expect(buttonOf(other).componentId).toBe(buttonOf(main).id);
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

  it('logos with different marks are variants of one Logo set, not Logo 2, Logo 3', () => {
    const vector = (x: number): RestNode => ({ id: id(), type: 'VECTOR', name: 'path', absoluteBoundingBox: { x, y: 500, width: 30, height: 30 }, fills: [{ type: 'SOLID', color: BLACK }] });
    const mark = (x: number, marks: number): RestNode => ({ id: id(), type: 'FRAME', name: 'div', absoluteBoundingBox: { x, y: 500, width: 100, height: 40 }, children: Array.from({ length: marks }, (_, i) => vector(x + i * 40)) });
    const { root, components } = repeatedOf(page([mark(0, 1), mark(120, 1), mark(240, 2), mark(360, 2), mark(480, 3), mark(600, 3)]));

    expect(components.map((c) => c.name)).toEqual(['Logo']);
    expect(components[0].variants).toHaveLength(3);
    expect(root.children!.map((c) => c.name)).toEqual(['Logo / Variant=1', 'Logo', 'Logo / Variant=2', 'Logo', 'Logo / Variant=3', 'Logo']);
  });

  it('a button, a badge, an input, an avatar and a nav link seen once are components named for what they are', () => {
    const badge: RestNode = { id: id(), type: 'FRAME', name: 'span', absoluteBoundingBox: { x: 600, y: 300, width: 48, height: 22 }, fills: [{ type: 'SOLID', color: BLUE }], cornerRadius: 11, children: [{ ...text('New', 606, 303), style: { fontFamily: 'Inter', fontSize: 12, fontWeight: 500 }, absoluteBoundingBox: { x: 606, y: 303, width: 36, height: 16 } }] };
    const input: RestNode = { id: id(), type: 'FRAME', name: 'email', dom: { tag: 'input' }, absoluteBoundingBox: { x: 0, y: 400, width: 240, height: 40 }, strokes: [{ type: 'SOLID', color: BLACK }], children: [text('you@company.com', 10, 410)] };
    const avatar: RestNode = { id: id(), type: 'RECTANGLE', name: 'Ada', absoluteBoundingBox: { x: 300, y: 400, width: 40, height: 40 }, cornerRadius: 20, fills: [{ type: 'IMAGE', imageRef: 'https://a/ada.png' }] };
    const nav: RestNode = { ...text('Pricing', 400, 30), dom: { tag: 'a', landmark: 'nav', press: 'link' } };
    const { components, root } = repeatedOf(page([button('Start', 800, BLUE), badge, input, avatar, nav]));

    expect(components.map((c) => c.name).sort()).toEqual(['Avatar', 'Badge', 'Button', 'Input', 'Nav link']);
    expect(root.children!.find((c) => c.name === 'Nav link')?.children?.[0].characters).toBe('Pricing');
  });

  it('a nav link that is only a text is wrapped in an instance of its own size, so it lands where the text was', () => {
    const link = (label: string, x: number): RestNode => ({ ...text(label, x, 30), dom: { tag: 'a', landmark: 'nav', press: 'link' } });
    const { root } = repeatedOf(page([link('Docs', 400), link('Blog', 500)]));
    const [main, other] = root.children!;

    expect(main).toMatchObject({ type: 'INSTANCE', absoluteBoundingBox: { x: 400, y: 30, width: 80, height: 20 }, fills: [] });
    expect(main.componentId).toBe(main.id);
    expect(other.componentId).toBe(main.id);
  });

  it('buttons with and without an icon are Icon variants of one Button set, not Button and Button 2', () => {
    const arrow = (x: number): RestNode => ({ id: id(), type: 'VECTOR', name: 'path', absoluteBoundingBox: { x, y: 30, width: 12, height: 12 }, fills: [{ type: 'SOLID', color: WHITE }] });
    const withIcon = (label: string, x: number): RestNode => {
      const base = button(label, x, BLUE);
      return { ...base, children: [...base.children!, arrow(x + 100)] };
    };
    const { components, root } = repeatedOf(page([button('Start', 0, BLUE), withIcon('Next', 140), button('Go', 280, BLUE)]));

    expect(components.map((c) => c.name)).toEqual(['Button']);
    expect(new Set(root.children!.map((c) => c.name))).toEqual(new Set(['Button / Icon=None', 'Button / Icon=Trailing', 'Button']));
  });

  it('filled and bordered buttons are Primary and Outline, not Style 1 and Style 2', () => {
    const outline = (label: string, x: number): RestNode => ({ ...button(label, x, BLUE), fills: [], strokes: [{ type: 'SOLID', color: BLACK }] });
    const { root } = repeatedOf(page([button('Start', 0, BLUE), outline('Docs', 140)]));

    expect(root.children!.map((c) => c.name)).toEqual(['Button / Style=Primary', 'Button / Style=Outline']);
  });

  it('two cards that differ by one line are variants of one Card set', () => {
    const longer = (x: number): RestNode => {
      const base = card('More', x, 'https://a/4.png');
      return { ...base, children: [...base.children!, text('By Ada', x + 10, 290)] };
    };
    const { components } = repeatedOf(page([card('One', 0, 'https://a/1.png'), card('Two', 220, 'https://a/2.png'), longer(440), longer(660)]));

    expect(components.map((c) => c.name)).toEqual(['Card']);
    expect(components[0].variants).toHaveLength(2);
  });

  it('icons repeated on their own are Icon, and an icon inside a component stays part of it', () => {
    const glyph = (x: number, y: number): RestNode => ({ id: id(), type: 'GROUP', name: 'icon', absoluteBoundingBox: { x, y, width: 20, height: 20 }, children: [{ id: id(), type: 'VECTOR', absoluteBoundingBox: { x, y, width: 20, height: 20 }, fills: [{ type: 'SOLID', color: BLACK }] }] });
    const framed = (x: number): RestNode => ({ ...button('Go', x, BLUE), children: [glyph(x + 4, 24), text('Go', x + 30, 30)] });
    const { components } = repeatedOf(page([glyph(0, 600), glyph(40, 600), framed(400), framed(600)]));

    expect(components.map((c) => c.name).sort()).toEqual(['Button', 'Icon']);
    expect(components.find((c) => c.name === 'Icon')!.variants[0].occurrences).toBe(2);
  });

  it('tiles of one grid with the same look are one set, though one shows a picture and another an icon', () => {
    const GREY = { r: 0.95, g: 0.95, b: 0.95, a: 1 };
    const tile = (x: number, art: RestNode, lines: number): RestNode => ({ id: id(), type: 'FRAME', name: 'div', absoluteBoundingBox: { x, y: 300, width: 300, height: 260 }, fills: [{ type: 'SOLID', color: GREY }], cornerRadius: 12, children: [art, ...Array.from({ length: lines }, (_, i) => text(`Line ${i}`, x + 16, 420 + i * 24))] });
    const picture = (x: number): RestNode => ({ id: id(), type: 'RECTANGLE', name: 'img', absoluteBoundingBox: { x, y: 300, width: 300, height: 100 }, fills: [{ type: 'IMAGE', imageRef: `https://a/${x}.png` }] });
    const glyph = (x: number): RestNode => ({ id: id(), type: 'VECTOR', name: 'path', absoluteBoundingBox: { x: x + 16, y: 316, width: 24, height: 24 }, fills: [{ type: 'SOLID', color: BLACK }] });
    const grid: RestNode = { id: id(), type: 'FRAME', name: 'div', absoluteBoundingBox: { x: 0, y: 300, width: 940, height: 260 }, children: [tile(0, picture(0), 2), tile(320, glyph(320), 3), tile(640, glyph(640), 2)] };
    const { components } = repeatedOf(page([grid]));

    expect(components).toHaveLength(1);
    expect(components[0].variants).toHaveLength(3);
  });

  it('a block with a price is a Pricing tier only when the price is per month, seat or year', () => {
    const tier = (x: number, period: string): RestNode => ({ id: id(), type: 'FRAME', name: 'div', absoluteBoundingBox: { x, y: 300, width: 300, height: 300 }, strokes: [{ type: 'SOLID', color: BLACK }], children: [text('Pro', x + 16, 316), text(`$20${period}`, x + 16, 360), text('For growing teams', x + 16, 400)] });

    expect(repeatedOf(page([tier(0, '/month')])).components.map((c) => c.name)).toEqual(['Pricing tier']);
    expect(repeatedOf(page([tier(0, ' billion')])).components.map((c) => c.name)).toEqual(['Card']);
  });

  it('a footer text inside a link is a Footer link though the link wraps it in other elements', () => {
    const link = (label: string, y: number): RestNode => ({ ...text(label, 400, y), dom: { tag: 'div', landmark: 'footer', press: 'link' } });
    const { components } = repeatedOf(page([link('Pricing', 700), link('Docs', 730)]));

    expect(components.map((c) => c.name)).toEqual(['Footer link']);
    expect(components[0].variants[0].occurrences).toBe(2);
  });

  it('a carousel slide scrolled off the page is left as it is, so the main is a card you can see (framer: an off-page main drew its copies shifted)', () => {
    const { root } = repeatedOf(page([card('Hidden', -260, 'https://a/0.png'), card('One', 0, 'https://a/1.png'), card('Two', 220, 'https://a/2.png')]));
    const [hidden, main] = root.children!;

    expect(hidden.type).toBe('FRAME');
    expect(main.componentId).toBe(main.id);
  });

  it('two Card sets are named after their sections, not Card and Card 2', () => {
    const GREY = { r: 0.9, g: 0.9, b: 0.9, a: 1 };
    const priced = (x: number): RestNode => ({ id: id(), type: 'FRAME', name: 'div', absoluteBoundingBox: { x, y: 400, width: 200, height: 160 }, fills: [{ type: 'SOLID', color: GREY }], children: [{ ...text('Pro', x + 10, 410), style: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700 } }, text('For teams', x + 10, 450)] });
    const section = (name: string, y: number, children: RestNode[]): RestNode => ({ id: id(), type: 'FRAME', name, absoluteBoundingBox: { x: 0, y, width: 1280, height: 300 }, children });
    const { components } = repeatedOf(page([section('Hero', 100, [card('One', 0, 'https://a/1.png'), card('Two', 220, 'https://a/2.png')]), section('Pricing', 400, [priced(0), priced(220)])]));

    expect(components.map((c) => c.name).sort()).toEqual(['Hero Card', 'Pricing Card']);
  });

  it('logo variants are named by their label, so the code says LogoNotion, not Logo4', () => {
    const vector = (x: number): RestNode => ({ id: id(), type: 'VECTOR', name: 'path', absoluteBoundingBox: { x, y: 500, width: 30, height: 30 }, fills: [{ type: 'SOLID', color: BLACK }] });
    const mark = (x: number, marks: number, label: string): RestNode => ({ id: id(), type: 'FRAME', name: label, absoluteBoundingBox: { x, y: 500, width: 100, height: 40 }, children: Array.from({ length: marks }, (_, i) => vector(x + i * 40)) });
    const { root } = repeatedOf(page([mark(0, 1, 'Notion'), mark(120, 1, 'Notion'), mark(240, 2, 'Zapier'), mark(360, 2, 'Zapier')]));

    expect(root.children!.map((c) => c.name)).toEqual(['Logo / Variant=Notion', 'Logo', 'Logo / Variant=Zapier', 'Logo']);
  });
});

