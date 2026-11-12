import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { StyleKind, type Style } from '@feega/motion-core/motion/styles-model';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { codePlan } from './code-doc';
import { parseSheets, readSheets } from './css-tokens';
import { tokenSetOf, variablesOf } from './design-tokens';
import { madeStyles, styleTokensOf } from './design-styles';
import { boundToTokens } from './design-bind';
import { boardBound, designBoard } from './design-board';
import { writeTokens } from './token-write';
import { pulledTokens } from './token-pull';

const WIDTH = 1280;
const read = fixture('typescale');

async function imported() {
  const parsed = parseSheets(await readSheets(read));
  const vars = variablesOf(tokenSetOf(parsed), 'app', { active: 'Light' });
  const styled = madeStyles(styleTokensOf(parsed), 'app', { side: WIDTH, scale: 1 });
  return { parsed, vars, styled };
}

let ids = 0;
const nid = () => `s${++ids}`;
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const INK = { r: 0x11 / 255, g: 0x11 / 255, b: 0x11 / 255, a: 1 };

const line = (name: string, cls: string, size: number, weight: number, lineHeightPx: number, tracking: number, y: number): RestNode => ({
  id: nid(),
  type: 'TEXT',
  name,
  characters: name,
  absoluteBoundingBox: box(20, y, 600, lineHeightPx),
  fills: [{ type: 'SOLID', color: INK }],
  style: { fontFamily: 'Inter', fontWeight: weight, fontSize: size, lineHeightPx, lineHeightUnit: 'PIXELS', letterSpacing: tracking * size },
  source: { at: `src/routes/+page.svelte:${y}:2`, tag: 'p', cls }
});

const card = (name: string, cls: string, y: number): RestNode => ({
  id: nid(),
  type: 'FRAME',
  name,
  absoluteBoundingBox: box(700, y, 200, 120),
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
  effects: [{ type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 4 }, radius: 12, spread: 0 }],
  source: { at: `src/routes/+page.svelte:${y}:4`, tag: 'div', cls }
});

const tree = (children: RestNode[]): PageTree => ({ title: '/', url: 'http://127.0.0.1:5000/', width: WIDTH, height: 1600, truncated: false, root: { id: nid(), type: 'FRAME', name: '/', absoluteBoundingBox: box(0, 0, WIDTH, 1600), fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children } });

const docOf = (page: PageTree) => codePlan(page, [], nid)!.plan.items[0].doc;
const clips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);
const named = (doc: MotionDoc, name: string) => clips(doc).find((c) => c.name === name)!;
const clipWith = (doc: MotionDoc, cls: string) => clips(doc).find((c) => c.source?.cls === cls)!;
const texts = (doc: MotionDoc) => clips(doc).flatMap((c) => (typeof c.props.text === 'string' ? [c.props.text] : []));

const changedLines = (before: string, after: string) => {
  const [a, b] = [before.split('\n'), after.split('\n')];
  return a.flatMap((l, i) => (l === b[i] ? [] : [[i + 1, l.trim(), b[i].trim()]]));
};

const restyled = (styles: Record<string, Style>, name: string, patch: Record<string, unknown>) => ({ ...styles, [name]: { ...styles[name], ...patch } as Style });

describe('parseSheets type rules', () => {
  it('una regola con font-size o box-shadow letterali dà le sue dichiarazioni, ma non quelle dentro un @media di larghezza', async () => {
    const { parsed } = await imported();

    expect(parsed.typed.map((t) => [t.selector, t.property, t.raw, t.at.line])).toEqual([
      ['article .prose h2', 'font-size', '1.5rem', 21],
      ['article .prose h2', 'font-weight', '600', 22],
      ['article .prose h2', 'line-height', '1.4', 23],
      ['article .prose h2', 'letter-spacing', '-0.025em', 24],
      ['.popover', 'box-shadow', '0 4px 12px rgba(0, 0, 0, 0.1)', 34]
    ]);
  });
});

describe('madeStyles', () => {
  it('la scala del testo e le regole tipografiche diventano stili di testo; le ombre stili effetto', async () => {
    const { styled } = await imported();

    expect(styled.styles['app Text/hero']).toEqual({ kind: StyleKind.Text, size: 48 / WIDTH, leading: Number((3.5 / 3).toFixed(4)), tracking: -0.02, weight: 700 });
    expect(styled.styles['app Text/body']).toEqual({ kind: StyleKind.Text, size: 16 / WIDTH, leading: 1.5 });
    expect(styled.styles['app Text/article prose h2']).toEqual({ kind: StyleKind.Text, size: 24 / WIDTH, weight: 600, leading: 1.4, tracking: -0.025 });
    expect(styled.styles['app Shadow/card']).toEqual({ kind: StyleKind.Effect, effects: [{ id: 'fx1', kind: 'drop-shadow', enabled: true, params: { distance: 0, x: 0, y: 4, blur: 12, spread: 0, color: '#000000', opacity: 0.1 } }] });
    expect(Object.keys(styled.styles)).toContain('app Shadow/popover');
  });

  it('la mappa riporta ogni campo di uno stile alla sua dichiarazione', async () => {
    const { styled } = await imported();

    expect(styled.map['app Text/hero#leading']).toMatchObject({ name: '--text-hero--line-height', style: 'app Text/hero', field: 'leading', origins: { Light: 'src/app.css:6:1' } });
    expect(styled.map['app Text/article prose h2#weight']).toMatchObject({ name: 'font-weight', rule: 'article .prose h2', origins: { Light: 'src/app.css:22:1' }, raw: { Light: '600' } });
  });

  it('breakpoint e easing sono variabili di Other, elencate e non legate', async () => {
    const { vars } = await imported();

    expect(vars.variables['app Other'].vars).toEqual({ md: { type: 'number', values: { Light: 768 } }, snappy: { type: 'string', values: { Light: 'cubic-bezier(0.2, 0, 0, 1)' } } });
  });
});

describe('boundToTokens styles', () => {
  it('lega lo stile per classe, per valore unico, e l’ombra per classe o per regola', async () => {
    const { parsed, vars, styled } = await imported();
    const page = tree([line('Hero', 'text-hero', 48, 700, 56, -0.02, 10), line('Body', '', 16, 400, 24, 0, 100), line('Other size', '', 13, 400, 18, 0, 140), card('Card', 'shadow-card', 200), card('Popover', 'popover', 400)]);

    const { doc } = boundToTokens(docOf(page), { ...vars, rules: parsed.rules, base: 'Light', boards: {}, styles: styled });

    expect(named(doc, 'Hero').styleRef).toBe('app Text/hero');
    expect(named(doc, 'Body').styleRef).toBe('app Text/body');
    expect(named(doc, 'Other size').styleRef).toBeUndefined();
    expect(clipWith(doc, 'shadow-card').effectStyleRef).toBe('app Shadow/card');
    expect(clipWith(doc, 'popover').effectStyleRef).toBe('app Shadow/popover');
    expect(doc.styles?.['app Text/hero']).toEqual(styled.styles['app Text/hero']);
  });

  it('una classe il cui stile non corrisponde a quello che si vede non lega', async () => {
    const { parsed, vars, styled } = await imported();

    const { doc } = boundToTokens(docOf(tree([line('Hero but small', 'text-hero', 20, 700, 24, -0.02, 10)])), { ...vars, rules: parsed.rules, base: 'Light', boards: {}, styles: styled });

    expect(named(doc, 'Hero but small').styleRef).toBeUndefined();
  });
});

describe('designBoard styles', () => {
  it('mostra una riga per stile di testo e una card per ombra, legate ai loro stili', async () => {
    const { vars, styled } = await imported();

    const doc = boardBound({ ...codePlan(designBoard(vars.variables, 1, new Set(), styled), [], nid)!.plan.items[0].doc, variables: vars.variables, styles: styled.styles });

    expect(texts(doc)).toEqual(expect.arrayContaining(['Text', 'hero', '48px · 1.1667 · 700', 'Shadow', 'card', 'Other', 'md', '768px', 'snappy']));
    expect(clips(doc).some((c) => c.styleRef === 'app Text/hero')).toBe(true);
    expect(clips(doc).some((c) => c.effectStyleRef === 'app Shadow/card')).toBe(true);
  });
});

describe('writeTokens styles', () => {
  it('uno stile di testo cambiato riscrive la sua dichiarazione nel suo formato, una riga sola', async () => {
    const { vars, styled } = await imported();
    const styles = restyled(styled.styles, 'app Text/hero', { size: 56 / WIDTH, weight: 800 });

    const done = await writeTokens(vars.variables, { ...vars.map, ...styled.map }, read, styles);

    expect(done.files.map((f) => f.path)).toEqual(['src/app.css']);
    expect(changedLines(done.files[0].before, done.files[0].after)).toEqual([
      [5, '--text-hero: 3rem;', '--text-hero: 3.5rem;'],
      [8, '--text-hero--font-weight: 700;', '--text-hero--font-weight: 800;']
    ]);
  });

  it('una regola tipografica cambiata tocca la sua dichiarazione, non quella del @media', async () => {
    const { vars, styled } = await imported();
    const styles = restyled(styled.styles, 'app Text/article prose h2', { size: 32 / WIDTH, tracking: -0.03 });

    const done = await writeTokens(vars.variables, { ...vars.map, ...styled.map }, read, styles);

    expect(changedLines(done.files[0].before, done.files[0].after)).toEqual([
      [21, 'font-size: 1.5rem;', 'font-size: 2rem;'],
      [24, 'letter-spacing: -0.025em;', 'letter-spacing: -0.03em;']
    ]);
  });

  it('un’ombra cambiata si riscrive come box-shadow', async () => {
    const { vars, styled } = await imported();
    const shadow = styled.styles['app Shadow/popover'] as Extract<Style, { kind: StyleKind.Effect }>;
    const styles = restyled(styled.styles, 'app Shadow/popover', { effects: [{ ...shadow.effects[0], params: { ...shadow.effects[0].params, y: 8, blur: 24 } }] });

    const done = await writeTokens(vars.variables, { ...vars.map, ...styled.map }, read, styles);

    expect(changedLines(done.files[0].before, done.files[0].after)).toEqual([[34, 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);', 'box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.1);']]);
  });
});

describe('pulledTokens styles', () => {
  const side = (styles: Record<string, Style>, map: Record<string, unknown>) => ({ doc: { ...docOf(tree([])), styles } as MotionDoc, map: map as never });

  it('uno stile cambiato sulla tela che il codice non ha toccato resta; uno solo sulla tela sopravvive', async () => {
    const { styled } = await imported();
    const local = side({ ...restyled(styled.styles, 'app Text/hero', { weight: 800 }), Mine: { kind: StyleKind.Text, weight: 300 } }, styled.map);

    const pulled = pulledTokens(local, side(styled.styles, styled.map));

    expect(pulled.doc.styles?.['app Text/hero']).toMatchObject({ weight: 800 });
    expect(pulled.doc.styles?.Mine).toEqual({ kind: StyleKind.Text, weight: 300 });
    expect(pulled.conflicts).toEqual([]);
  });

  it('se anche il codice ha cambiato lo stesso campo vince il codice, e lo dice', async () => {
    const { styled } = await imported();
    const upstreamMap = { ...styled.map, 'app Text/hero#weight': { ...styled.map['app Text/hero#weight'], raw: { Light: '900' } } };

    const pulled = pulledTokens(side(restyled(styled.styles, 'app Text/hero', { weight: 800 }), styled.map), side(restyled(styled.styles, 'app Text/hero', { weight: 900 }), upstreamMap));

    expect(pulled.doc.styles?.['app Text/hero']).toMatchObject({ weight: 900 });
    expect(pulled.conflicts).toEqual(['--text-hero--font-weight: changed in the code too, the code wins; the canvas value was 800']);
  });
});
