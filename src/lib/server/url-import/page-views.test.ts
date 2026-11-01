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
    expect(Number(headline(phoneView).props.size) * Math.min(phoneView.width, phoneView.height)).toBeCloseTo(60 * scale, 1);
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

  const textStyle = (size: number, extra: Record<string, unknown> = {}) => ({ fontFamily: 'Inter', fontWeight: 400, fontSize: size, lineHeightUnit: 'PIXELS', lineHeightPx: size * 1.2, textAlignHorizontal: 'LEFT', ...extra });
  const textOf = (key: string, box: Box, characters: string, style = textStyle(24)): RestNode => ({ id: key, key, type: 'TEXT', name: characters, characters, style, textAutoResize: 'HEIGHT', absoluteBoundingBox: box, fills: [{ type: 'SOLID', color: BLUE }] });
  const shownTexts = (d: MotionDoc) => (d.tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => c.component === 'Text' && !c.hidden).map((c) => c.props.text);
  const planned = (wide: PageTree, reads: { view: (typeof PAGE_VIEWS)[number]; tree: PageTree }[]) => {
    let n = 0;
    return urlPlan(wide, () => `c${++n}`, (r) => r, {}, undefined, reads)!;
  };

  it('a layer the phone page words differently shows the phone words on the phone view and the desktop words on desktop (stripe: the hero headline drops its second sentence)', () => {
    const wide = pageOf(1280, 800, [textOf('h', { x: 40, y: 100, width: 900, height: 60 }, 'Financial infrastructure to grow your revenue. Accept payments.')]);
    const narrow = pageOf(390, 800, [textOf('h', { x: 16, y: 100, width: 340, height: 60 }, 'Financial infrastructure to grow your revenue.')]);
    const doc = planned(wide, [{ view: PAGE_VIEWS[1], tree: narrow }]).plan.items[0].doc;

    expect(shownTexts(resolveView(doc, PAGE_VIEWS[1].id))).toEqual(['Financial infrastructure to grow your revenue.']);
    expect(shownTexts(doc)).toEqual(['Financial infrastructure to grow your revenue. Accept payments.']);
  });

  it('a picture the phone page swaps for another source shows that source on the phone view (srcset: the hero art)', () => {
    const [WIDE, SMALL] = ['https://example.com/hero-wide.jpg', 'https://example.com/hero-small.jpg'];
    const picture = (box: Box, url: string): RestNode => ({ ...card('hero', box), fills: [{ type: 'IMAGE', imageRef: url, scaleMode: 'FILL' }] });
    const made = planned(pageOf(1280, 800, [picture({ x: 0, y: 0, width: 1280, height: 600 }, WIDE)]), [{ view: PAGE_VIEWS[1], tree: pageOf(390, 800, [picture({ x: 0, y: 0, width: 390, height: 500 }, SMALL)]) }]);
    const item = made.plan.items[0];
    const shownPicture = (d: MotionDoc) => {
      const shown = new Set((d.tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => !c.hidden).map((c) => c.id));
      return item.images.filter((i) => shown.has(i.clipId) || (i.innerId && shown.has(i.innerId))).map((i) => made.images[i.hash]);
    };

    expect(shownPicture(resolveView(item.doc, PAGE_VIEWS[1].id))).toEqual([SMALL]);
    expect(shownPicture(item.doc)).toEqual([WIDE]);
  });

  it('a phone page far longer than the desktop one fits its view whole (stripe: the phone page ran past the frame maximum and lost its last quarter)', () => {
    const long = pageOf(390, 30000, [card('a', { x: 20, y: 80, width: 350, height: 300 }), card('b', { x: 20, y: 29000, width: 350, height: 300 })]);
    const doc = planned(desktop, [{ view: PAGE_VIEWS[1], tree: long }]).plan.items[0].doc;
    const phoneView = resolveView(doc, PAGE_VIEWS[1].id);
    const scale = doc.width / 1280;
    const px = (b: Box) => ({ x: Math.round(b.x * scale), y: Math.round(b.y * scale), width: Math.round(b.width * scale), height: Math.round(b.height * scale) });

    expect(phoneView.height).toBe(Math.round(30000 * scale));
    expect(boxesOf(phoneView, cardsIn(doc)).b).toEqual(px({ x: 20, y: 29000, width: 350, height: 300 }));
  });

  it('a layer only the tablet page shows stays hidden on the phone view (the tablet menu bar)', () => {
    const bar: RestNode = { ...card('bar', { x: 0, y: 0, width: 768, height: 40 }), fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }] };
    const tablet = pageOf(768, 800, [card('a', { x: 20, y: 80, width: 350, height: 300 }), bar]);
    const doc = planned(desktop, [
      { view: PAGE_VIEWS[0], tree: tablet },
      { view: PAGE_VIEWS[1], tree: phone }
    ]).plan.items[0].doc;
    const red = (d: MotionDoc) => (d.tracks.flatMap((t) => t.clips) as MotionClip[]).find((c) => JSON.stringify(c.props.fills ?? []).toUpperCase().includes('#FF0000'));

    expect(red(resolveView(doc, PAGE_VIEWS[0].id))?.hidden).toBeFalsy();
    expect(red(resolveView(doc, PAGE_VIEWS[1].id))?.hidden).toBe(true);
  });

  it('text takes the letter spacing and font axes the phone page sets (stripe: the hero set wider at a smaller optical size)', () => {
    const wide = pageOf(1280, 800, [textOf('h', { x: 40, y: 100, width: 900, height: 60 }, 'Grow your revenue', textStyle(48, { letterSpacing: -0.96, fontAxes: "'opsz' 48" }))]);
    const narrow = pageOf(390, 800, [textOf('h', { x: 16, y: 100, width: 340, height: 40 }, 'Grow your revenue', textStyle(34, { letterSpacing: -0.68, fontAxes: "'opsz' 34" }))]);
    const doc = planned(wide, [{ view: PAGE_VIEWS[1], tree: narrow }]).plan.items[0].doc;
    const scale = doc.width / 1280;
    const [headline] = (resolveView(doc, PAGE_VIEWS[1].id).tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => c.component === 'Text' && !c.hidden);

    expect(headline.props.axes).toBe("'opsz' 34");
    expect(parseFloat(String(headline.props.letterSpacing))).toBeCloseTo(-0.68 * scale, 1);
  });

  it('a rounded card stays one layer and keeps its corner radius in pixels on the phone view (cards: a copy per view, or rounder on a narrower box)', () => {
    const rounded = (box: Box): RestNode => ({ ...card('a', box), cornerRadius: 16 });
    const doc = planned(pageOf(1280, 800, [rounded({ x: 40, y: 100, width: 580, height: 300 })]), [{ view: PAGE_VIEWS[1], tree: pageOf(390, 800, [rounded({ x: 20, y: 80, width: 350, height: 100 })]) }]).plan.items[0].doc;
    const scale = doc.width / 1280;
    const phoneView = resolveView(doc, PAGE_VIEWS[1].id);
    const blue = (d: MotionDoc) => (d.tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => !c.hidden && JSON.stringify(c.props.fills ?? []).toUpperCase().includes(BLUE_FILL));
    const [shown] = blue(phoneView);
    const corner = Number(/^M([\d.]+) /.exec(String(shown.props.path))?.[1]) * Number(shown.props.width) * phoneView.width;

    expect(blue(phoneView).map((c) => c.id)).toEqual(blue(doc).map((c) => c.id));
    expect(corner).toBeCloseTo(16 * scale, 0);
  });

  it('a run that starts after an inline chip keeps its lines where the page put them, not joined into a block of its own (overreacted.io: "for a paragraph," right-aligned over the next line)', () => {
    const line = (key: string, x: number, y: number, width: number, characters: string): RestNode => ({ ...textOf(key, { x, y, width, height: 28 }, characters), textAutoResize: undefined });
    const narrow = pageOf(390, 800, [line('p~0', 20, 300, 340, 'However, because these concepts have been given agreed-upon names ('), card('p/code1', { x: 230, y: 330, width: 34, height: 24 }), line('p~1.0', 270, 328, 60, 'for a'), line('p~1.1', 20, 356, 90, 'paragraph,')]);
    const doc = planned(pageOf(1280, 800, [line('p~0', 40, 300, 700, 'Wide paragraph')]), [{ view: PAGE_VIEWS[1], tree: narrow }]).plan.items[0].doc;

    expect(shownTexts(resolveView(doc, PAGE_VIEWS[1].id))).toEqual(['However, because these concepts have been given agreed-upon names (', 'for a', 'paragraph,']);
  });

  it('an answer the phone page keeps folded stays hidden on the phone view (feega.app: every FAQ answer drawn over the next question)', () => {
    const folded = (key: string, box: Box, characters: string): RestNode => ({ ...textOf(key, box, characters), collapsed: true });
    const wide = pageOf(1280, 800, [textOf('q', { x: 40, y: 100, width: 600, height: 30 }, 'What is Feega?'), folded('a', { x: 40, y: 140, width: 600, height: 30 }, 'One infinite canvas.')]);
    const narrow = pageOf(390, 800, [textOf('q', { x: 16, y: 100, width: 300, height: 30 }, 'What is Feega?'), folded('a', { x: 16, y: 140, width: 300, height: 60 }, 'One infinite canvas.'), folded('b', { x: 16, y: 220, width: 300, height: 60 }, 'Only on phones.')]);
    const doc = planned(wide, [{ view: PAGE_VIEWS[1], tree: narrow }]).plan.items[0].doc;

    expect(shownTexts(resolveView(doc, PAGE_VIEWS[1].id))).toEqual(['What is Feega?']);
  });

  it('a picture inside a block faded by a mask that only the phone page has keeps its picture (framer.com: the glowing panel came in as a grey box)', () => {
    const SHOT = 'https://example.com/panel.png';
    const fade = { type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 0 }], gradientStops: [{ position: 0.6, color: { r: 0, g: 0, b: 0, a: 1 } }, { position: 1, color: { r: 0, g: 0, b: 0, a: 0 } }] };
    const panel: RestNode = { ...card('panel', { x: 0, y: 300, width: 390, height: 260 }), fills: [{ type: 'SOLID', color: WHITE }], maskGradient: fade, children: [{ ...card('panel/img0', { x: 20, y: 320, width: 200, height: 200 }), fills: [{ type: 'IMAGE', imageRef: SHOT, scaleMode: 'FILL' }] }, card('panel/div1', { x: 240, y: 320, width: 100, height: 100 })] };
    const made = planned(desktop, [{ view: PAGE_VIEWS[1], tree: { ...phone, root: { ...phone.root, children: [...phone.root.children!, panel] } } }]);
    const item = made.plan.items[0];
    const inComps = new Set(Object.values(item.doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips.map((k) => k.id))));

    expect(item.images.filter((i) => made.images[i.hash] === SHOT).some((i) => inComps.has(i.clipId))).toBe(true);
  });

  it('a page whose desktop read already holds every picture an import takes still brings the pictures only its phone read has (apple.com: the phone photos came in blank)', () => {
    const DESKTOP_PICTURES = 200;
    const picture = (i: number, y: number): RestNode => ({ ...card(`p${i}`, { x: 0, y, width: 100, height: 4 }), fills: [{ type: 'IMAGE', imageRef: `https://example.com/${i}.jpg`, scaleMode: 'FILL' }] });
    const wide = pageOf(1280, 1000, Array.from({ length: DESKTOP_PICTURES }, (_, i) => picture(i, i * 5)));
    const PHONE_ONLY = 'https://example.com/phone.jpg';
    const narrow = pageOf(390, 800, [{ ...card('only', { x: 0, y: 0, width: 390, height: 300 }), fills: [{ type: 'IMAGE', imageRef: PHONE_ONLY, scaleMode: 'FILL' }] }]);

    expect(Object.values(planned(wide, [{ view: PAGE_VIEWS[1], tree: narrow }]).images)).toContain(PHONE_ONLY);
  });

  it('a glow only the phone page paints below a card stays below it on the phone view (vercel.com: the glow lit up around every card)', () => {
    const tinted = (key: string, box: Box, r: number): RestNode => ({ ...card(key, box), fills: [{ type: 'SOLID', color: { r, g: 0, b: 0, a: 1 } }] });
    const wide = pageOf(1280, 800, [tinted('card', { x: 40, y: 100, width: 500, height: 300 }, 0.2), tinted('column', { x: 700, y: 100, width: 500, height: 300 }, 0.4)]);
    const narrow = pageOf(390, 1200, [tinted('column', { x: 30, y: 150, width: 330, height: 200 }, 0.4), tinted('glow', { x: 10, y: 90, width: 370, height: 320 }, 0.9), tinted('card', { x: 20, y: 100, width: 350, height: 300 }, 0.2)]);
    const doc = planned(wide, [{ view: PAGE_VIEWS[1], tree: narrow }]).plan.items[0].doc;
    const order = (resolveView(doc, PAGE_VIEWS[1].id).tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => !c.hidden).map((c) => JSON.stringify(c.props.fills));
    const at = (r: string) => order.findIndex((f) => f?.includes(r));

    expect(at('#e60000')).toBeLessThan(at('#330000'));
  });

  it('a layer only the phone page has stays above the matched box it sits in, even when the desktop paints that box later (tailwindcss.com: the phone heading drawn under its section)', () => {
    const tinted = (key: string, box: Box, r: number, children: RestNode[] = []): RestNode => ({ ...card(key, box), fills: [{ type: 'SOLID', color: { r, g: 0, b: 0, a: 1 } }], children });
    const wide = pageOf(1280, 800, [tinted('b', { x: 40, y: 20, width: 500, height: 60 }, 0.2), tinted('a', { x: 40, y: 100, width: 500, height: 300 }, 0.4)]);
    const narrow = pageOf(390, 1200, [tinted('a', { x: 20, y: 100, width: 350, height: 300 }, 0.4, [tinted('a/x', { x: 40, y: 120, width: 100, height: 40 }, 0.9)]), tinted('b', { x: 20, y: 500, width: 350, height: 100 }, 0.2)]);
    const doc = planned(wide, [{ view: PAGE_VIEWS[1], tree: narrow }]).plan.items[0].doc;
    const order = (resolveView(doc, PAGE_VIEWS[1].id).tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => !c.hidden).map((c) => JSON.stringify(c.props.fills));
    const at = (r: string) => order.findIndex((f) => f?.includes(r));

    expect(at('#e60000')).toBeGreaterThan(at('#660000'));
  });
});
