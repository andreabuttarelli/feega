import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { CodeImportOutcome, importCodeAt } from './import-code';
import { BASE_CONDITIONS, Scheme } from './render-conditions';
import { Responsive, responsiveOf } from './code-views';
import { applyEdits, editsOf } from './write-back';
import { OverrideKey, setOverride } from '@feega/motion-core/motion/breakpoints/model';
import { askOf, APP } from './code-import.testkit';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const BLUE = { r: 0, g: 0.4, b: 1, a: 1 };

type Box = { x: number; y: number; width: number; height: number };

const card = (key: string, box: Box, at: string): RestNode => ({ id: key, key, type: 'FRAME', name: key, absoluteBoundingBox: box, fills: [{ type: 'SOLID', color: BLUE }], children: [], source: { at, tag: 'div', cls: '' } });

const pageOf = (width: number, height: number, children: RestNode[]): PageTree => ({
  title: 'Home',
  url: `${APP}/`,
  width,
  height,
  truncated: false,
  root: { id: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width, height }, fills: [{ type: 'SOLID', color: WHITE }], clipsContent: true, children }
});

const row = (box: Box, mode: string, gap: number, kids: RestNode[]): RestNode => ({ id: 'row', key: 'row', type: 'FRAME', name: 'row', absoluteBoundingBox: box, fills: [], layoutMode: mode, itemSpacing: gap, children: kids, source: { at: 'src/a.tsx:2:1', tag: 'div', cls: 'row' } });

const TREES: Record<number, PageTree> = {
  1280: pageOf(1280, 800, [row({ x: 40, y: 100, width: 1200, height: 300 }, 'HORIZONTAL', 40, [card('a', { x: 40, y: 100, width: 580, height: 300 }, 'src/a.tsx:3:1'), card('b', { x: 660, y: 100, width: 580, height: 300 }, 'src/a.tsx:4:1')])]),
  768: pageOf(768, 900, [row({ x: 24, y: 100, width: 720, height: 300 }, 'HORIZONTAL', 40, [card('a', { x: 24, y: 100, width: 330, height: 300 }, 'src/a.tsx:3:1'), card('b', { x: 400, y: 100, width: 330, height: 300 }, 'src/a.tsx:4:1')])]),
  390: pageOf(390, 1100, [row({ x: 20, y: 80, width: 350, height: 620 }, 'VERTICAL', 20, [card('a', { x: 20, y: 80, width: 350, height: 300 }, 'src/a.tsx:3:1'), card('b', { x: 20, y: 400, width: 350, height: 300 }, 'src/a.tsx:4:1')])])
};

const widths = [1280, 768, 390];

function sized() {
  const made = askOf({ routes: ['/'], conditions: widths.map((width) => ({ scheme: Scheme.Light, width })) });
  let width = BASE_CONDITIONS.width;
  made.tab.viewport.mockImplementation(async (w: number) => {
    width = w;
  });
  made.tab.tree.mockImplementation(async () => TREES[width]);
  return made;
}

const docOf = (docs: Map<string, { doc: unknown }>) => docs.get('frame-1')!.doc as MotionDoc;

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips) as MotionClip[];

describe('code import at several widths of one page', () => {
  it('lands one frame whose narrower widths are breakpoint views of the widest', async () => {
    const { ask, docs } = sized();

    const done = await importCodeAt(ask);

    expect(done.outcome).toBe(CodeImportOutcome.Ok);
    expect(docs.size).toBe(1);
    expect(docOf(docs).breakpoints?.map((b) => b.width)).toEqual([768, 390]);
  });

  it('keeps one layer per element, the views only carry overrides', async () => {
    const { ask, docs } = sized();

    await importCodeAt(ask);

    const sourced = clipsOf(docOf(docs)).filter((c) => c.source?.at === 'src/a.tsx:3:1');
    expect(sourced).toHaveLength(1);
    expect(Object.keys(sourced[0].overrides ?? {}).sort()).toEqual(['w390', 'w768']);
  });

  it('reports every width of the page on the one clip that holds them', async () => {
    const { ask } = sized();

    const done = await importCodeAt(ask);

    const ok = done as Extract<typeof done, { outcome: CodeImportOutcome.Ok }>;
    expect(ok.boards?.map((b) => b.cond)).toEqual(['light@1280', 'light@768', 'light@390']);
    expect(new Set(ok.boards?.map((b) => b.clip)).size).toBe(1);
    expect(ok.boards?.map((b) => b.view)).toEqual([undefined, 'w768', 'w390']);
  });

  it('keeps separate boards when asked for boards', async () => {
    const { ask, docs } = sized();

    const done = await importCodeAt({ ...ask, responsive: Responsive.Boards });

    expect(done.outcome).toBe(CodeImportOutcome.Ok);
    expect(docOf(docs).breakpoints ?? []).toEqual([]);
    expect((done as { boards?: unknown[] }).boards).toHaveLength(3);
  });

  it('does not turn a dark theme into a view', async () => {
    const { ask, docs } = sized();

    await importCodeAt({ ...ask, conditions: [BASE_CONDITIONS, { scheme: Scheme.Dark, width: 390 }] });

    expect(docOf(docs).breakpoints ?? []).toEqual([]);
  });

  it('says that components are left out when widths become views', async () => {
    const { ask } = sized();

    const done = await importCodeAt(ask);

    const ok = done as Extract<typeof done, { outcome: CodeImportOutcome.Ok }>;
    expect(ok.skipped.join('\n')).toMatch(/Button.*not extracted.*views/);
  });

  it('keeps boards for several pages and says why', async () => {
    const { ask, docs } = sized();

    const done = await importCodeAt({ ...ask, routes: ['/', '/settings'] });

    const ok = done as Extract<typeof done, { outcome: CodeImportOutcome.Ok }>;
    expect(docOf(docs).breakpoints ?? []).toEqual([]);
    expect(ok.skipped.join('\n')).toMatch(/views need one page/i);
  });
});

const SOURCE = 'export const A = () => (\n <div className="row">\n <div className="a" />\n <div className="b" />\n </div>);\n';

const read = async (path: string) => (path === 'src/a.tsx' ? SOURCE : null);

const rowOf = (doc: MotionDoc) => clipsOf(doc).find((c) => c.source?.at === 'src/a.tsx:2:1')!;

describe('write-back of an imported page with views', () => {
  it('an untouched import has nothing to write', async () => {
    const { ask, docs } = sized();

    await importCodeAt(ask);

    expect(editsOf(docOf(docs))).toEqual([]);
  });

  it('an edit made in the phone view is refused, never written as a base style', async () => {
    const { ask, docs } = sized();
    await importCodeAt(ask);
    const doc = docOf(docs);
    const edited = setOverride(doc, 'w390', rowOf(doc).id, OverrideKey.Gap, 64);
    expect(edited.ok).toBe(true);

    const written = await applyEdits(editsOf((edited as { doc: MotionDoc }).doc), read);

    expect(written.files).toEqual([]);
    expect(written.skipped.join('\n')).toMatch(/src\/a\.tsx:2: edited in the 390px view, a rule for one width is not written/);
  });

  it('an edit made on the base still writes, and the views are not part of it', async () => {
    const { ask, docs } = sized();
    await importCodeAt(ask);
    const doc = docOf(docs);
    const changed = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (c.id === rowOf(doc).id ? { ...c, autoLayout: { ...c.autoLayout!, gap: 99 } } : c)) })) } as MotionDoc;

    const written = await applyEdits(editsOf(changed), read);

    expect(written.files[0].after).toMatch(/gap.{0,4}99/);
    expect(written.skipped.join('\n')).not.toMatch(/view/);
  });
});

describe('pull of a frame imported with views', () => {
  it('captures the widths as views again, and a frame of boards stays boards', () => {
    const page = (view?: string) => ({ map: { pages: [{ boards: [{ view }] }] } });

    expect(responsiveOf(page('w390'))).toBe(Responsive.Views);
    expect(responsiveOf(page())).toBe(Responsive.Boards);
    expect(responsiveOf({})).toBe(Responsive.Boards);
  });
});
