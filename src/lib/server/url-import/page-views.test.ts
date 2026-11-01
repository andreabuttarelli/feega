import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { urlPlan } from './url-doc';
import { PAGE_VIEWS } from './page-views';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const BLUE = { r: 0, g: 0.4, b: 1, a: 1 };

type Box = { x: number; y: number; width: number; height: number };

const card = (key: string, box: Box): RestNode => ({ id: key, key, type: 'FRAME', name: key, absoluteBoundingBox: box, fills: [{ type: 'SOLID', color: BLUE }], children: [] });

const pageOf = (width: number, height: number, children: RestNode[]): PageTree => ({
  title: 'Page',
  url: 'https://example.com/',
  width,
  height,
  truncated: false,
  root: { id: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width, height }, fills: [{ type: 'SOLID', color: WHITE }], clipsContent: true, children }
});

const desktop = pageOf(1280, 800, [card('a', { x: 40, y: 100, width: 580, height: 300 }), card('b', { x: 660, y: 100, width: 580, height: 300 }), card('c', { x: 40, y: 450, width: 1200, height: 100 })]);
const phone = pageOf(390, 1200, [card('a', { x: 20, y: 80, width: 350, height: 300 }), card('b', { x: 20, y: 400, width: 350, height: 300 })]);

const boxesOf = (doc: MotionDoc, named: Record<string, string>) => {
  const clips = doc.tracks.flatMap((t) => t.clips) as MotionClip[];
  return Object.fromEntries(
    clips
      .filter((c) => named[c.id])
      .map((c) => {
        const p = c.props as { x: number; y: number; width: number; height: number };
        return [named[c.id], c.hidden ? 'hidden' : { x: Math.round((p.x - p.width / 2) * doc.width), y: Math.round((p.y - p.height / 2) * doc.height), width: Math.round(p.width * doc.width), height: Math.round(p.height * doc.height) }];
      })
  );
};

const BLUE_FILL = '#0066FF';

const cardsIn = (doc: MotionDoc): Record<string, string> => {
  const clips = (doc.tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => JSON.stringify(c.props.fills ?? []).toUpperCase().includes(BLUE_FILL));
  const order = [...clips].sort((a, b) => Number(a.props.y) - Number(b.props.y) || Number(a.props.x) - Number(b.props.x));
  return Object.fromEntries(order.map((c, i) => [c.id, 'abc'[i]]));
};

describe('a page read at desktop and phone width', () => {
  it('becomes one frame whose phone breakpoint places, sizes and hides each layer as the phone page did', () => {
    let n = 0;
    const made = urlPlan(desktop, () => `c${++n}`, (r) => r, {}, undefined, [{ view: PAGE_VIEWS[1], tree: phone }])!;
    const doc = made.plan.items[0].doc;
    const scale = doc.width / 1280;
    const phoneView = resolveView(doc, PAGE_VIEWS[1].id);
    const px = (b: Box) => ({ x: Math.round(b.x * scale), y: Math.round(b.y * scale), width: Math.round(b.width * scale), height: Math.round(b.height * scale) });

    const named = cardsIn(doc);
    expect(doc.breakpoints?.map((b) => [b.name, b.width])).toEqual([['Phone', Math.round(390 * scale)]]);
    expect(phoneView.width).toBe(Math.round(390 * scale));
    expect(boxesOf(phoneView, named)).toEqual({ a: px({ x: 20, y: 80, width: 350, height: 300 }), b: px({ x: 20, y: 400, width: 350, height: 300 }), c: 'hidden' });
    expect(boxesOf(doc, named)).toEqual({ a: px({ x: 40, y: 100, width: 580, height: 300 }), b: px({ x: 660, y: 100, width: 580, height: 300 }), c: px({ x: 40, y: 450, width: 1200, height: 100 }) });
  });

  it('a layer the phone page has and the desktop page hides comes in hidden, and shows on the phone view (feega.app: the phone menu)', () => {
    const menu: RestNode = { ...card('menu', { x: 300, y: 10, width: 60, height: 30 }), fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }] };
    let n = 0;
    const made = urlPlan(desktop, () => `c${++n}`, (r) => r, {}, undefined, [{ view: PAGE_VIEWS[1], tree: { ...phone, root: { ...phone.root, children: [...phone.root.children!, menu] } } }])!;
    const doc = made.plan.items[0].doc;
    const red = (d: MotionDoc) => (d.tracks.flatMap((t) => t.clips) as MotionClip[]).find((c) => JSON.stringify(c.props.fills ?? []).toUpperCase().includes('#FF0000'));

    expect(red(doc)?.hidden).toBe(true);
    expect(red(resolveView(doc, PAGE_VIEWS[1].id))?.hidden).toBeFalsy();
  });

  it('the phone view runs as long as the phone page, so the layers it stacks below the desktop fold stay in the frame (overreacted.io: the article lost past the desktop height)', () => {
    const long = pageOf(390, 1500, [card('a', { x: 20, y: 80, width: 350, height: 300 }), card('b', { x: 20, y: 400, width: 350, height: 300 }), card('c', { x: 20, y: 1100, width: 350, height: 300 })]);
    let n = 0;
    const made = urlPlan(desktop, () => `c${++n}`, (r) => r, {}, undefined, [{ view: PAGE_VIEWS[1], tree: long }])!;
    const doc = made.plan.items[0].doc;
    const scale = doc.width / 1280;
    const phoneView = resolveView(doc, PAGE_VIEWS[1].id);
    const px = (b: Box) => ({ x: Math.round(b.x * scale), y: Math.round(b.y * scale), width: Math.round(b.width * scale), height: Math.round(b.height * scale) });

    const roots = (phoneView.tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => !c.parent);

    expect(phoneView.height).toBeGreaterThanOrEqual(Math.round(1400 * scale));
    expect(roots.map((c) => Math.round(Number(c.props.width) * phoneView.width))).toEqual(roots.map(() => phoneView.width));
    expect(boxesOf(phoneView, cardsIn(doc)).c).toEqual(px({ x: 20, y: 1100, width: 350, height: 300 }));
  });

  it('a one-line desktop headline wraps on the phone view at the phone size (feega.app: the hero title ran off the phone frame)', () => {
    const style = (size: number) => ({ fontFamily: 'Inter', fontWeight: 600, fontSize: size, lineHeightUnit: 'PIXELS', lineHeightPx: size, textAlignHorizontal: 'LEFT' });
    const title = (key: string, box: Box, size: number, characters: string): RestNode => ({ id: key, key, type: 'TEXT', name: characters, characters, style: style(size), absoluteBoundingBox: box, fills: [{ type: 'SOLID', color: BLUE }] });
    const wide = pageOf(1280, 800, [title('h', { x: 40, y: 100, width: 700, height: 80 }, 80, 'The smart canvas'), title('k', { x: 780, y: 100, width: 80, height: 80 }, 80, 'Go')]);
    const narrow = pageOf(390, 800, [title('h.0', { x: 20, y: 100, width: 300, height: 60 }, 60, 'The smart'), title('h.1', { x: 20, y: 160, width: 260, height: 60 }, 60, 'canvas'), title('k', { x: 20, y: 240, width: 60, height: 60 }, 60, 'Go')]);
    let n = 0;
    const made = urlPlan(wide, () => `c${++n}`, (r) => r, {}, undefined, [{ view: PAGE_VIEWS[1], tree: narrow }])!;
    const doc = made.plan.items[0].doc;
    const scale = doc.width / 1280;
    const headline = (d: MotionDoc) => (d.tracks.flatMap((t) => t.clips) as MotionClip[]).find((c) => c.props.text === 'The smart canvas')!;
    const phoneView = resolveView(doc, PAGE_VIEWS[1].id);

    expect(headline(doc).props.textWrap).toBe('none');
    expect(headline(phoneView).props).toMatchObject({ textWrap: 'wrap', sizing: 'auto-height', lineHeight: `${60 * scale}px` });
    expect(Number(headline(phoneView).props.size) * Math.min(phoneView.width, phoneView.height)).toBeCloseTo(60 * scale);
  });

  it('a paragraph read line by line comes in as one text that rewraps on the phone view, not lines laid over each other (feega.app: the hero paragraph)', () => {
    const style = { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, lineHeightUnit: 'PIXELS', lineHeightPx: 20, textAlignHorizontal: 'LEFT' };
    const line = (key: string, x: number, y: number, width: number, characters: string): RestNode => ({ id: key, key, type: 'TEXT', name: characters, characters, style, absoluteBoundingBox: { x, y, width, height: 20 }, fills: [{ type: 'SOLID', color: BLUE }] });
    const wide = pageOf(1280, 800, [line('p.0', 440, 100, 400, 'From AI generation to motion,'), line('p.1', 470, 120, 340, 'bring your workflow in.')]);
    const narrow = pageOf(390, 800, [line('p.0', 40, 100, 310, 'From AI generation to'), line('p.1', 60, 120, 270, 'motion, bring your'), line('p.2', 95, 140, 200, 'workflow in.')]);
    let n = 0;
    const made = urlPlan(wide, () => `c${++n}`, (r) => r, {}, undefined, [{ view: PAGE_VIEWS[1], tree: narrow }])!;
    const doc = made.plan.items[0].doc;
    const scale = doc.width / 1280;
    const texts = (d: MotionDoc) => (d.tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => c.component === 'Text');
    const [para] = texts(resolveView(doc, PAGE_VIEWS[1].id));
    const p = para.props as { x: number; y: number; width: number; height: number; align: string };

    expect(texts(doc).map((c) => c.props.text)).toEqual(['From AI generation to motion, bring your workflow in.']);
    expect(p.align).toBe('center');
    expect(Math.round((p.x - p.width / 2) * resolveView(doc, PAGE_VIEWS[1].id).width)).toBe(Math.round(40 * scale));
    expect(Math.round(p.width * resolveView(doc, PAGE_VIEWS[1].id).width)).toBe(Math.round(310 * scale));
  });

  it('a phone-only image keeps its picture (feega.app: the phone logo came in as a grey box)', () => {
    const LOGO = 'https://example.com/logo.png';
    const logo: RestNode = { ...card('logo', { x: 12, y: 12, width: 64, height: 36 }), fills: [{ type: 'IMAGE', imageRef: LOGO, scaleMode: 'FILL' }] };
    let n = 0;
    const made = urlPlan(desktop, () => `c${++n}`, (r) => r, {}, undefined, [{ view: PAGE_VIEWS[1], tree: { ...phone, root: { ...phone.root, children: [...phone.root.children!, logo] } } }])!;

    expect(Object.values(made.images)).toContain(LOGO);
  });

  it('a phone-only layer whose node id the desktop page also uses leaves the desktop layer placed by its own phone box (feega.app: the hero lost to an FAQ answer)', () => {
    const menu: RestNode = { ...card('menu', { x: 300, y: 10, width: 60, height: 30 }), id: 'a', fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }] };
    let n = 0;
    const made = urlPlan(desktop, () => `c${++n}`, (r) => r, {}, undefined, [{ view: PAGE_VIEWS[1], tree: { ...phone, root: { ...phone.root, children: [...phone.root.children!, menu] } } }])!;
    const doc = made.plan.items[0].doc;
    const scale = doc.width / 1280;
    const px = (b: Box) => ({ x: Math.round(b.x * scale), y: Math.round(b.y * scale), width: Math.round(b.width * scale), height: Math.round(b.height * scale) });

    expect(boxesOf(resolveView(doc, PAGE_VIEWS[1].id), cardsIn(doc)).a).toEqual(px({ x: 20, y: 80, width: 350, height: 300 }));
  });
});
