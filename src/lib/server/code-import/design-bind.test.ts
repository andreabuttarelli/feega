import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { codePlan } from './code-doc';
import { boardsOf, conditioned } from './boards';
import { parseSheets, readSheets } from './css-tokens';
import { tokenSetOf, variablesOf } from './design-tokens';
import { boundToTokens } from './design-bind';
import { setActiveMode, variableValue } from '$lib/motion/variables';
import { conditionKey, Scheme } from './render-conditions';

type Rgb = { r: number; g: number; b: number; a: number };

const rgb = (hex: string): Rgb => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255, a: 1 });

let ids = 0;
const nid = () => `n${++ids}`;
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const text = (characters: string, hex: string, cls: string, y: number): RestNode => ({
  id: nid(),
  type: 'TEXT',
  name: characters,
  characters,
  absoluteBoundingBox: box(20, y, 120, 16),
  fills: [{ type: 'SOLID', color: rgb(hex) }],
  style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 14 },
  source: { at: `src/routes/+page.svelte:${y}:2`, tag: 'p', cls }
});

const block = (name: string, hex: string, tag: string, cls: string, y: number): RestNode => ({
  id: nid(),
  type: 'FRAME',
  name,
  absoluteBoundingBox: box(200, y, 120, 40),
  fills: [{ type: 'SOLID', color: rgb(hex) }],
  source: { at: `src/routes/+page.svelte:${y}:4`, tag, cls }
});

const page = (title: string, ground: string, children: RestNode[]): PageTree => ({
  title,
  url: 'http://127.0.0.1:5000/',
  width: 400,
  height: 400,
  truncated: false,
  root: { id: nid(), type: 'FRAME', name: title, absoluteBoundingBox: box(0, 0, 400, 400), fills: [{ type: 'SOLID', color: rgb(ground) }], children }
});

const LIGHT_PAGE = () =>
  page('/', '#ffffff', [
    text('By class', '#111111', 'text-primary font-semibold', 10),
    text('Same grey everywhere', '#111111', '', 40),
    text('Unique grey', '#777777', 'text-sm', 70),
    text('Class says muted, colour disagrees', '#ff0000', 'text-muted', 100),
    text('Hover variant only', '#111111', 'hover:text-primary', 130),
    block('Card', '#ffffff', 'div', 'bg-card rounded-card', 160),
    block('Cta', '#5bcefa', 'a', 'btn-cta', 220)
  ]);

const DARK_PAGE = () => conditioned(page('/', '#141414', [text('By class', '#f0f0f0', 'text-primary', 10)]), conditionKey({ scheme: Scheme.Dark, width: 1280 }));

async function made() {
  const parsed = parseSheets(await readSheets(fixture('tailwind4')));
  return { parsed, made: variablesOf(tokenSetOf(parsed), 'traidue.com', { active: 'Light' }) };
}

const docOf = (tree: PageTree) => codePlan(tree, [], nid)!.plan.items[0].doc;

const clipNamed = (doc: MotionDoc, name: string) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.name === name)!;

const clipWith = (doc: MotionDoc, cls: string) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.source?.cls === cls)!;

describe('boundToTokens', () => {
  it('lega per classe, per regola var() e per valore unico; un valore ambiguo resta letterale', async () => {
    const { parsed, made: vars } = await made();

    const { doc, bound } = boundToTokens(docOf(LIGHT_PAGE()), { ...vars, rules: parsed.rules, base: 'Light', boards: {} });

    expect(clipNamed(doc, 'By class').bind).toEqual({ color: 'traidue Colors/primary' });
    expect(clipNamed(doc, 'Same grey everywhere').bind).toBeUndefined();
    expect(clipNamed(doc, 'Unique grey').bind).toEqual({ color: 'traidue Colors/muted' });
    expect(clipNamed(doc, 'Class says muted, colour disagrees').bind).toBeUndefined();
    expect(clipNamed(doc, 'Hover variant only').bind).toBeUndefined();
    expect(clipWith(doc, 'bg-card rounded-card').bind).toMatchObject({ fill: 'traidue Colors/card' });
    expect(clipWith(doc, 'btn-cta').bind).toMatchObject({ fill: 'traidue Colors/brand-blue' });
    expect(bound).toMatchObject({ byClass: 2, byRule: 1, byValue: 1 });
  });

  it('traidue: primary, success ed error sono tutti #111111 in Light e #f0f0f0 in Dark — senza classe nessun valore li distingue', async () => {
    const { parsed, made: vars } = await made();
    const tree = page('/', '#ffffff', [text('Callout', '#111111', 'font-bold', 10), text('Callout dark tone', '#f0f0f0', '', 40)]);

    const { doc } = boundToTokens(docOf(tree), { ...vars, rules: parsed.rules, base: 'Light', boards: {} });

    expect(clipNamed(doc, 'Callout').bind).toBeUndefined();
    expect(clipNamed(doc, 'Callout dark tone').bind).toBeUndefined();
  });

  it('cambiare il modo attivo ricolora i livelli legati', async () => {
    const { parsed, made: vars } = await made();
    const { doc } = boundToTokens(docOf(LIGHT_PAGE()), { ...vars, rules: parsed.rules, base: 'Light', boards: {} });

    const dark = setActiveMode(doc, 'traidue Colors', 'Dark');

    expect(dark.ok && clipNamed(dark.doc, 'By class').props.color).toBe('#f0f0f0');
    expect(dark.ok && variableValue(dark.doc.variables, 'traidue Colors/primary')).toBe('#f0f0f0');
  });

  it('i livelli di una tavola Dark non vengono legati finché il modo è uno per frame, e vengono contati', async () => {
    const { parsed, made: vars } = await made();
    const tree = boardsOf('traidue', [
      { label: '/', tree: LIGHT_PAGE(), uses: [] },
      { label: '/ · dark', tree: DARK_PAGE(), uses: [] }
    ]).tree;

    const { doc, bound } = boundToTokens(docOf(tree), { ...vars, rules: parsed.rules, base: 'Light', boards: { '/': 'Light', '/ · dark': 'Dark' } });

    const named = doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.name === 'By class');
    expect(named.map((c) => c.bind?.color ?? null).sort()).toEqual(['traidue Colors/primary', null].sort());
    expect(bound.otherMode).toBeGreaterThan(0);
  });
});
