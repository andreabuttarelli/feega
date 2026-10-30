import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { flattenComps } from '@feega/motion-core/motion/precomp';
import { VarType } from '@feega/motion-core/motion/variables-model';
import type { RestNode } from '$lib/server/figma/rest-message';
import { defineVariable } from '$lib/motion/variables';
import { FULL_SHAPE, urlPlan, type UrlPlan } from './url-doc';
import type { PageTree } from './page-tree';

const INK = { r: 0.07, g: 0.07, b: 0.07, a: 1 };
const INK_TWIN = { r: 0.075, g: 0.07, b: 0.07, a: 1 };
const INDIGO = { r: 0.37, g: 0.42, b: 0.82, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const GREY = { r: 0.93, g: 0.93, b: 0.93, a: 1 };

let ids = 0;
const id = () => `n${++ids}`;
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const text = (characters: string, x: number, y: number, color = INK, fontSize = 15): RestNode => ({ id: id(), type: 'TEXT', name: characters, characters, absoluteBoundingBox: box(x, y, 90, 20), fills: [{ type: 'SOLID', color }], style: { fontFamily: 'Inter', fontSize, fontWeight: 500 } });

const button = (label: string, x: number, y: number, fill: typeof INK, ink: typeof INK): RestNode => ({ id: id(), type: 'FRAME', name: 'button', absoluteBoundingBox: box(x, y, 140, 44), fills: [{ type: 'SOLID', color: fill }], cornerRadius: 8, children: [text(label, x + 20, y + 12, ink)] });

const tile = (title: string, x: number, ink: typeof INK): RestNode => ({
  id: id(),
  type: 'FRAME',
  name: 'article',
  absoluteBoundingBox: box(x, 300, 280, 200),
  fills: [{ type: 'SOLID', color: GREY }],
  strokes: [{ type: 'SOLID', color: GREY }],
  cornerRadius: 12,
  children: [text(title, x + 20, 320, ink, 22), text('Ship faster with less.', x + 20, 360)]
});

const body = (y: number): RestNode[] => Array.from({ length: 4 }, (_, i) => text(`Paragraph ${i}`, 600, y + i * 30));

function tree(): PageTree {
  const root: RestNode = {
    id: id(),
    type: 'FRAME',
    name: 'Page',
    absoluteBoundingBox: box(0, 0, 1280, 800),
    fills: [{ type: 'SOLID', color: WHITE }],
    children: [button('Start', 40, 40, INDIGO, WHITE), button('Sign up', 200, 40, INDIGO, WHITE), button('Docs', 360, 40, GREY, INK), button('Help', 520, 40, GREY, INK), tile('Fast', 40, INK), tile('Simple', 340, INK_TWIN), ...body(600)]
  };
  return { title: 'Acme', url: 'https://acme.com/', width: 1280, height: 800, root, truncated: false };
}

function planned(): UrlPlan {
  let n = 0;
  return urlPlan(tree(), () => `c${++n}`, undefined, {}, FULL_SHAPE)!;
}

const pageOf = (plan: UrlPlan) => plan.plan.items[0].doc;

const mainsOf = (doc: MotionDoc) => Object.entries(doc.comps).filter(([, c]) => c.component);

const leaves = (doc: MotionDoc) => flattenComps(doc).tracks.flatMap((t) => t.clips as MotionClip[]);

const ok = (r: { ok: true; doc: MotionDoc } | { ok: false; error: string }) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

describe('repeated blocks of an imported page become a component kit', () => {
  it('a button main has a text property for its label', () => {
    const doc = pageOf(planned());
    const buttons = mainsOf(doc).filter(([, c]) => c.component!.name === 'Button');

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(([, c]) => c.component!.properties?.Label?.kind === 'text')).toBe(true);
  });

  it('a card main has a title and a text property', () => {
    const doc = pageOf(planned());
    const card = mainsOf(doc).find(([, c]) => c.component!.name.startsWith('Card'));

    expect(Object.keys(card?.[1].component!.properties ?? {}).sort()).toEqual(['Text', 'Title']);
  });

  it('buttons get Hover and Pressed states bound to darker variables of their colour', () => {
    const doc = pageOf(planned());
    const states = mainsOf(doc).map(([, c]) => c.component!.variant?.State).filter(Boolean);
    const vars = doc.variables!.Acme.vars;

    expect(new Set(states)).toEqual(new Set(['Default', 'Hover', 'Pressed']));
    expect(vars['Primary hover'].values.Default).not.toBe(vars.Primary.values.Default);
    expect(mainsOf(doc).some(([, c]) => c.component!.variant?.State === 'Hover' && c.tracks.some((t) => t.clips.some((clip) => clip.bind?.fill === 'Acme/Primary hover')))).toBe(true);
  });

  it('an instance whose colour was a near twin of the main keeps the main token binding', () => {
    const doc = pageOf(planned());
    const edited = ok(defineVariable(doc, 'Acme', 'Text', { type: VarType.Colour, values: { Default: '#00aa55' } }));
    const titles = leaves(edited).filter((c) => ['Fast', 'Simple'].includes(String(c.props.text)));

    expect(titles.map((c) => String(c.props.color).toLowerCase())).toEqual(['#00aa55', '#00aa55']);
  });

  it('the mains also sit on a Components frame beside the page', () => {
    const plan = planned();
    const sheet = plan.plan.items.find((item) => item.name === 'Components');

    expect(sheet).toBeDefined();
    expect(sheet!.centre.x).toBeGreaterThan(plan.plan.items[0].size.width / 2);
    expect(sheet!.doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp').map((c) => c.props.comp).sort()).toEqual(mainsOf(pageOf(plan)).map(([id]) => id).sort());
    expect(plan.homes).toEqual({ 0: plan.plan.items.indexOf(sheet!) });
  });

  it('the Components frame is painted with the page Background variable, so light text stays readable', () => {
    const sheet = planned().plan.items.find((item) => item.name === 'Components')!;
    const [backdrop] = sheet.doc.tracks.flatMap((t) => t.clips);

    expect(backdrop.component).toBe('Shape');
    expect(backdrop.bind?.fill).toBe('Acme/Background');
  });
});

const framed = (doc: MotionDoc) => [{ tracks: doc.tracks, width: doc.width, height: doc.height }, ...Object.values(doc.comps).map((c) => ({ tracks: c.tracks, width: c.frame?.width ?? doc.width, height: c.frame?.height ?? doc.height }))];

const radiusPx = (doc: MotionDoc, key: string) =>
  framed(doc).flatMap((s) => (s.tracks.flatMap((t) => t.clips) as MotionClip[]).filter((c) => c.bind?.radius === key).map((c) => Number(c.props.roundness) * Math.min(Number(c.props.width) * s.width, Number(c.props.height) * s.height)));

describe('corner radii are bound to radius variables', () => {
  it('a button corner is a rect bound to its radius variable and follows an edit', () => {
    const doc = pageOf(planned());
    const radius = 'Radius S';
    const px = Number(doc.variables!.Acme.vars[radius].values.Default);
    const key = `Acme/${radius}`;

    expect(radiusPx(doc, key).length).toBeGreaterThan(0);
    radiusPx(doc, key).forEach((r) => expect(r).toBeCloseTo(px, 0));

    const edited = ok(defineVariable(doc, 'Acme', radius, { type: VarType.Number, values: { Default: 4 } }));
    radiusPx(edited, key).forEach((r) => expect(r).toBeCloseTo(4, 0));
  });
});
