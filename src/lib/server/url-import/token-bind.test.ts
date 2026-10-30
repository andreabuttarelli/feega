import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { elementFills } from '@feega/motion-core/motion/fill/elements';
import { leadingOf, trackingOf } from '@feega/motion-core/motion/type-units';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { defineStyle } from '$lib/motion/styles';
import { defineVariable } from '$lib/motion/variables';
import type { PageTree } from './page-tree';
import type { PageOutline } from './page-outline';
import { FULL_SHAPE, Tokening, urlPlan } from './url-doc';

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

const pageOf = (name: string): PageTree => ({ ...read<PageTree>(`./fixtures/${name}.json`), outline: read<PageOutline>(`./fixtures/outlines/${name}.json`) });

function docOf(name: string, tokening: Tokening): MotionDoc {
  let n = 0;
  return urlPlan(pageOf(name), () => `id${++n}`, undefined, {}, { ...FULL_SHAPE, tokening })!.plan.items[0].doc;
}

type Placed = { clip: MotionClip; width: number };

function placed(doc: MotionDoc): Map<string, Placed> {
  const scopes = [{ tracks: doc.tracks, width: doc.width }, ...Object.values(doc.comps).map((c) => ({ tracks: c.tracks, width: c.frame?.width ?? doc.width }))];
  return new Map(scopes.flatMap((s) => s.tracks.flatMap((t) => (t.clips as MotionClip[]).map((clip) => [clip.id, { clip, width: s.width }] as const))));
}

const ok = (r: { ok: true; doc: MotionDoc } | { ok: false; error: string }) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const SITES = ['stripe', 'linear', 'vercel'];

const canonical = (value: unknown): unknown => (Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value);

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const NEAR = 6;
const nearColour = (a: string, b: string) => channels(a).every((c, i) => Math.abs(c - channels(b)[i]) <= NEAR);

function lookOf({ clip, width }: Placed) {
  const px = Number(clip.props.size ?? 0) * width;
  const fill = elementFills(clip.component, clip.props)[0];
  const leading = clip.props.size ? leadingOf(clip.props, px) : null;
  return {
    font: clip.props.font,
    weight: clip.props.weight,
    textCase: clip.props.textCase,
    px: Math.round(px * 100) / 100,
    leading: typeof leading === 'number' ? Math.round(leading * 100) / 100 : leading,
    tracking: clip.props.size ? Math.round(trackingOf(clip.props, px) * 1000) / 1000 : null,
    colour: fill && 'color' in fill ? String(fill.color).toLowerCase() : null,
    effects: clip.effects.map(({ id: _id, ...e }) => e)
  };
}

describe('imported pages become tokens', () => {
  it.each(SITES)('%s: colours are variables and text styles are named styles', (name) => {
    const doc = docOf(name, Tokening.On);
    const site = name[0].toUpperCase() + name.slice(1);
    const colours = Object.keys(doc.variables?.[site]?.vars ?? {});
    const styles = Object.keys(doc.styles ?? {});

    console.info(name, JSON.stringify(Object.fromEntries(Object.entries(doc.variables![site].vars).map(([k, v]) => [k, v.values.Default]))), styles.join(', '));
    expect(colours).toEqual(expect.arrayContaining(['Background', 'Text']));
    expect(styles).toContain(`${site} Body`);
  });

  it.each(SITES)('%s: the import looks the same, only bound to tokens', (name) => {
    const plain = placed(docOf(name, Tokening.Off));
    const bound = placed(docOf(name, Tokening.On));
    const drifted = [...plain].filter(([id, before]) => {
      const [a, b] = [lookOf(before), lookOf(bound.get(id)!)];
      const sameColour = a.colour === b.colour || (a.colour !== null && b.colour !== null && nearColour(a.colour, b.colour));
      return !sameColour || JSON.stringify(canonical({ ...a, colour: null })) !== JSON.stringify(canonical({ ...b, colour: null }));
    });

    expect(bound.size).toBe(plain.size);
    expect(drifted.map(([id, p]) => [id, lookOf(p), lookOf(bound.get(id)!)])).toEqual([]);
  });

  it('editing Primary recolours every layer bound to it, in every section', () => {
    const doc = docOf('stripe', Tokening.On);
    const users = [...placed(doc).values()].filter((p) => Object.values(p.clip.bind ?? {}).includes('Stripe/Primary'));

    const edited = placed(ok(defineVariable(doc, 'Stripe', 'Primary', { type: VarType.Colour, values: { Default: '#00aa55' } })));

    expect(users.length).toBeGreaterThan(1);
    expect(users.map((p) => lookOf(edited.get(p.clip.id)!).colour)).toEqual(users.map(() => '#00aa55'));
  });

  it('editing a text style restyles every linked text', () => {
    const doc = docOf('stripe', Tokening.On);
    const linked = [...placed(doc).values()].filter((p) => p.clip.styleRef === 'Stripe Body');

    const edited = placed(ok(defineStyle(doc, 'Stripe Body', { ...doc.styles!['Stripe Body'], weight: 800 })));

    expect(linked.length).toBeGreaterThan(1);
    expect(linked.map((p) => edited.get(p.clip.id)!.clip.props.weight)).toEqual(linked.map(() => 800));
  });

  it.each(SITES)('%s: borders are bound to colour variables, and editing one restrokes them', (name) => {
    const doc = docOf(name, Tokening.On);
    const site = name[0].toUpperCase() + name.slice(1);
    const stroked = [...placed(doc).values()].filter((p) => p.clip.bind?.stroke);
    const key = String(stroked[0]?.clip.bind?.stroke);
    const [collection, variable] = key.split('/');

    const edited = placed(ok(defineVariable(doc, collection, variable, { type: VarType.Colour, values: { Default: '#00aa55' } })));
    const strokeOf = (p: Placed) => (p.clip.props.strokes as { paint: { color: string } }[])[0].paint.color;

    expect(collection).toBe(site);
    expect(stroked.filter((p) => p.clip.bind!.stroke === key).map((p) => strokeOf(edited.get(p.clip.id)!))).toEqual(stroked.filter((p) => p.clip.bind!.stroke === key).map(() => '#00aa55'));
  });

  it.each(SITES)('%s: the page background is bound to Background', (name) => {
    const doc = docOf(name, Tokening.On);
    const site = name[0].toUpperCase() + name.slice(1);
    const backgrounds = [...placed(doc).values()].filter((p) => p.clip.bind?.fill === `${site}/Background`);

    expect(backgrounds.length).toBeGreaterThan(0);
  });
});
