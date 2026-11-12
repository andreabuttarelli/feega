import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { codePlan } from './code-doc';
import { boardsOf, conditioned } from './boards';
import { parseSheets, readSheets } from './css-tokens';
import { tokenSetOf, variablesOf } from './design-tokens';
import { boundToTokens, spacingMultiples } from './design-bind';
import { defineVariable, setActiveMode, variableValue } from '$lib/motion/variables';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { instanceTracks } from '@feega/motion-core/motion/layout/resolve';
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

  it('Tailwind 4: p-4 e gap-2 si legano al multiplo di --spacing, il resto della scala no', async () => {
    const parsed = parseSheets(await readSheets(fixture('tailwind4')));
    const classes = ['p-4', 'gap-2', 'p-[13px]', 'gap-x-3', 'text-primary'];
    expect(spacingMultiples(classes)).toEqual([2, 4]);
    const vars = variablesOf(tokenSetOf(parsed), 'traidue.com', { active: 'Light', multiples: spacingMultiples(classes) });
    const stack: RestNode = { ...block('Stack', '#ffffff', 'div', 'p-4 gap-2', 10), layoutMode: 'VERTICAL', paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, itemSpacing: 8, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN', children: [text('a', '#123456', '', 30), text('b', '#123456', '', 60)] };

    const { doc } = boundToTokens(docOf(page('/', '#ffffff', [stack])), { ...vars, rules: parsed.rules, base: 'Light', boards: {} });

    expect(clipWith(doc, 'p-4 gap-2').bind).toMatchObject({ 'autoLayout.padding': 'traidue Spacing/4', 'autoLayout.gap': 'traidue Spacing/2' });
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

  it('una tavola Dark è la stessa struttura legata, risolta nel modo Dark della sua tavola', async () => {
    const { parsed, made: vars } = await made();
    const tree = boardsOf('traidue', [
      { label: '/', tree: LIGHT_PAGE(), uses: [] },
      { label: '/ · dark', tree: DARK_PAGE(), uses: [] }
    ]).tree;

    const { doc, bound } = boundToTokens(docOf(tree), { ...vars, rules: parsed.rules, base: 'Light', boards: { '/': 'Light', '/ · dark': 'Dark' } });

    const named = () => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.name === 'By class');
    expect(named().map((c) => c.bind?.color)).toEqual(['traidue Colors/primary', 'traidue Colors/primary']);
    expect(clipNamed(doc, '/ · dark').modes).toEqual({ 'traidue Colors': 'Dark' });
    expect(clipNamed(doc, '/').modes).toBeUndefined();
    expect(named().map((c) => c.props.color)).toEqual(['#111111', '#f0f0f0']);
    expect(bound).not.toHaveProperty('otherMode');

    const edited = defineVariable(doc, 'traidue Colors', 'primary', { type: VarType.Colour, values: { Light: '#1565c0', Dark: '#ffd54f' } });
    const after = edited.ok ? edited.doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.name === 'By class').map((c) => c.props.color) : [];
    expect(after).toEqual(['#1565c0', '#ffd54f']);
  });

  it("un'istanza su una tavola Dark perde l'override letterale che il modo Dark già dà, e segue il token", async () => {
    const { parsed, made: vars } = await made();
    const badge = (hex: string): RestNode => ({ ...block('Badge', hex, 'span', 'badge', 300), use: 0 });
    const light = { ...LIGHT_PAGE(), root: { ...LIGHT_PAGE().root, children: [badge('#777777')] } };
    const dark = conditioned({ ...light, root: { ...light.root, fills: [{ type: 'SOLID', color: rgb('#141414') }], children: [badge('#888888')] } }, conditionKey({ scheme: Scheme.Dark, width: 1280 }));
    const marked = boardsOf('traidue', [
      { label: '/', tree: light, uses: [{ component: 'Badge', props: {} }] },
      { label: '/ · dark', tree: dark, uses: [{ component: 'Badge', props: {} }] }
    ]);
    const planned = codePlan(marked.tree, marked.uses, nid)!.plan.items[0].doc;

    const { doc } = boundToTokens(planned, { ...vars, rules: parsed.rules, base: 'Light', boards: { '/': 'Light', '/ · dark': 'Dark' } });

    const hosts = doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => c.component === 'Precomp');
    const fills = (d: MotionDoc) => hosts.map((h) => {
      const host = d.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.id === h.id)!;
      const comp = d.comps[String(host.props.comp)];
      return instanceTracks(d, host, comp, { width: d.width, height: d.height }).flatMap((t) => t.clips as MotionClip[]).find((c) => c.bind?.fill)?.props.fill;
    });
    expect(hosts).toHaveLength(2);
    expect(fills(doc)).toEqual(['#777777', '#888888']);
    expect(hosts[1].props.overrides).toBeUndefined();
    const edited = defineVariable(doc, 'traidue Colors', 'muted', { type: VarType.Colour, values: { Light: '#aaaaaa', Dark: '#222222' } });
    expect(edited.ok && fills(edited.doc)).toEqual(['#aaaaaa', '#222222']);
  });
});

describe('boundToTokens font and border', () => {
  const SHEET = ':root {\n  --font-heading: "Inter", system-ui, sans-serif;\n  --font-mono: "JetBrains Mono", monospace;\n  --border-width-hair: 2px;\n}\n.frame { border-width: var(--border-width-hair); }\n';

  it('una classe font-* lega la famiglia; un bordo letto da var() lega il suo spessore', () => {
    const parsed = parseSheets([{ path: 'src/app.css', text: SHEET }]);
    const vars = variablesOf(tokenSetOf(parsed), 'app', { active: 'Light' });
    const framed: RestNode = { ...block('Framed', '#ffffff', 'div', 'frame', 60), strokes: [{ type: 'SOLID', color: rgb('#111111') }], strokeWeight: 2 };

    const { doc } = boundToTokens(docOf(page('/', '#ffffff', [text('Heading', '#111111', 'font-heading', 10), framed])), { ...vars, rules: parsed.rules, base: 'Light', boards: {} });

    expect(clipNamed(doc, 'Heading').bind).toMatchObject({ font: 'app Type/heading' });
    expect(clipWith(doc, 'frame').bind).toMatchObject({ border: 'app Border/hair' });
  });
});
