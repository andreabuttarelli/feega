import { describe, expect, it } from 'vitest';
import { compOf, type MotionClip, type MotionComp, type MotionDoc } from '@feega/motion-core/motion/doc';
import { flattenComps, overridden } from '@feega/motion-core/motion/precomp';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { withStacking } from '@feega/motion-core/motion/layout/stacking';
import { withoutHidden } from '@feega/motion-core/motion/organize';
import { apply2d, pivotBox, worldAt } from '@feega/motion-core/motion/parent';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';
import { LOOK, LookKey, mapClips, minSideOf } from '$lib/canvas/code-look';
import { codePlan } from './code-doc';
import { rebased } from './repo-sync';
import { editsOf } from './write-back';

const BLUE = { r: 0.1, g: 0.2, b: 0.9, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const GREY = { r: 0.9, g: 0.9, b: 0.9, a: 1 };

let ids = 0;
const nid = () => String(++ids);
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const text = (characters: string, x: number, y: number): RestNode => ({ id: nid(), type: 'TEXT', name: characters, characters, absoluteBoundingBox: box(x, y, 60, 16), fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], style: { fontFamily: 'Inter', fontWeight: 500, fontSize: 14 } });

const framed = (use: number, at: [number, number, number, number], color: typeof BLUE, children: RestNode[]): RestNode => ({ id: nid(), type: 'FRAME', name: 'div', use, absoluteBoundingBox: box(...at), fills: [{ type: 'SOLID', color }], children });

const TREE: PageTree = {
  title: 'Dashboard',
  url: 'https://sb.vercel.run/',
  width: 400,
  height: 300,
  truncated: false,
  root: {
    id: nid(),
    type: 'FRAME',
    name: 'Dashboard',
    absoluteBoundingBox: box(0, 0, 400, 300),
    fills: [{ type: 'SOLID', color: WHITE }],
    children: [
      framed(0, [10, 10, 80, 30], BLUE, [text('Save', 20, 17)]),
      framed(1, [100, 10, 80, 30], BLUE, [text('Cancel', 110, 17)]),
      framed(2, [200, 10, 80, 30], WHITE, [text('Open', 210, 17)]),
      framed(3, [10, 100, 150, 100], GREY, [framed(4, [20, 110, 100, 20], GREY, [text('Revenue', 22, 112)])]),
      framed(5, [200, 100, 150, 100], GREY, [framed(6, [210, 110, 100, 20], GREY, [text('Sales', 212, 112)])])
    ]
  }
};

const USES: ComponentUse[] = [
  { component: 'Button', props: { variant: 'default', children: 'Save' } },
  { component: 'Button', props: { variant: 'default', children: 'Cancel' } },
  { component: 'Button', props: { variant: 'outline', children: 'Open' } },
  { component: 'Card', props: {} },
  { component: 'CardTitle', props: { children: 'Revenue' } },
  { component: 'Card', props: {} },
  { component: 'CardTitle', props: { children: 'Sales' } }
];

const docOf = () => codePlan(TREE, USES, nid)!.plan.items[0].doc;

const allClips = (doc: MotionDoc) => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips) as MotionClip[];

const mainsNamed = (doc: MotionDoc, name: string) => Object.entries(doc.comps).filter(([, c]) => c.component?.name === name);

const hostsOf = (doc: MotionDoc, compId: string) => allClips(doc).filter((c) => compOf(c) === compId);

function shownTexts(doc: MotionDoc, comp: MotionComp, host: MotionClip, depth = 0): string[] {
  const clips = overridden(comp.tracks, host, comp.component).flatMap((t) => t.clips as MotionClip[]);
  return clips.flatMap((c) => (typeof c.props.text === 'string' ? [c.props.text] : compOf(c) && depth < 8 ? shownTexts(doc, doc.comps[compOf(c)!], c, depth + 1) : []));
}

function textAt(doc: MotionDoc, tree: PageTree, characters: string) {
  const flat = flattenComps(withStacking(withAutoLayout(withoutHidden(doc))));
  const size = { width: flat.width, height: flat.height };
  const clip = flat.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.props.text === characters)!;
  const [x, y] = apply2d(worldAt(flat, clip.id, 0, size), [pivotBox(clip.props, size).left, pivotBox(clip.props, size).top]);
  const k = flat.width / tree.width;
  return { x: Math.round(x / k), y: Math.round(y / k) };
}

describe('codePlan', () => {
  it('ogni combinazione di props di un componente è una variante dello stesso insieme', () => {
    const doc = docOf();
    const buttons = mainsNamed(doc, 'Button');

    expect(buttons.map(([, c]) => c.component!.variant)).toEqual(expect.arrayContaining([{ variant: 'default' }, { variant: 'outline' }]));
    expect(buttons).toHaveLength(2);
    expect(new Set(buttons.map(([, c]) => c.component!.set))).toEqual(new Set(['Button']));
  });

  it('il secondo uso della stessa variante è un\'istanza del primo, col suo testo', () => {
    const doc = docOf();
    const [mainId, main] = mainsNamed(doc, 'Button').find(([, c]) => c.component!.variant!.variant === 'default')!;
    const hosts = hostsOf(doc, mainId);

    expect(hosts).toHaveLength(2);
    expect(hosts.map((h) => shownTexts(doc, main, h)[0]).sort()).toEqual(['Cancel', 'Save']);
  });

  it('un testo dentro un componente annidato si sovrascrive dall\'istanza esterna', () => {
    const doc = docOf();
    const [cardId, card] = mainsNamed(doc, 'Card')[0];
    const hosts = hostsOf(doc, cardId);

    expect(mainsNamed(doc, 'Card')).toHaveLength(1);
    expect(hosts.map((h) => shownTexts(doc, card, h)[0]).sort()).toEqual(['Revenue', 'Sales']);
  });

  it('un uso con un\'icona diversa resta un\'istanza, con l\'icona come override', () => {
    const icon = (path: string, x: number): RestNode => ({ id: nid(), type: 'VECTOR', name: 'path', absoluteBoundingBox: box(x, 17, 16, 16), fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], fillGeometry: [{ path }] });
    const row = (use: number, x: number, path: string, label: string) => framed(use, [x, 10, 120, 30], BLUE, [icon(path, x + 4), text(label, x + 24, 17)]);
    const tree: PageTree = { ...TREE, root: { ...TREE.root, children: [row(0, 10, 'M 0 0 L 16 0 L 16 16 Z', 'Home'), row(1, 140, 'M 0 0 L 16 16 L 0 16 Z', 'Tasks'), row(2, 270, 'M 0 0 L 16 0 L 16 16 Z', 'Apps')] } };
    const uses = ['Home', 'Tasks', 'Apps'].map((children) => ({ component: 'NavLink', props: { children } }));
    const doc = codePlan(tree, uses, nid)!.plan.items[0].doc;
    const [mainId, main] = mainsNamed(doc, 'NavLink')[0];
    const hosts = hostsOf(doc, mainId);
    const tasks = hosts.find((h) => shownTexts(doc, main, h)[0] === 'Tasks')!;

    expect(hosts).toHaveLength(3);
    expect(JSON.stringify(tasks.props.overrides)).toContain('"path"');
  });

  it('un bottone in auto layout con un testo più lungo resta un\'istanza', () => {
    const label = (characters: string, x: number, width: number): RestNode => ({ ...text(characters, x, 17), absoluteBoundingBox: box(x, 17, width, 16) });
    const flex = (use: number, x: number, width: number, child: RestNode): RestNode => ({ ...framed(use, [x, 10, width, 30], BLUE, [child]), layoutMode: 'HORIZONTAL', paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, itemSpacing: 0, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN' });
    const tree: PageTree = { ...TREE, root: { ...TREE.root, children: [flex(0, 10, 50, label('Save', 20, 30)), flex(1, 100, 70, label('Download', 110, 50))] } };
    const uses = ['Save', 'Download'].map((children) => ({ component: 'Button', props: { children } }));
    const doc = codePlan(tree, uses, nid)!.plan.items[0].doc;
    const [mainId, main] = mainsNamed(doc, 'Button')[0];

    expect(hostsOf(doc, mainId).map((h) => shownTexts(doc, main, h)[0]).sort()).toEqual(['Download', 'Save']);
  });

  it('un componente annidato visto per la prima volta dentro un\'istanza ha il suo main', () => {
    const icon = (use: number, path: string, x: number): RestNode => ({ id: nid(), type: 'VECTOR', name: 'svg', use, absoluteBoundingBox: box(x, 17, 16, 16), fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], fillGeometry: [{ path }] });
    const row = (use: number, x: number, child: RestNode) => framed(use, [x, 10, 120, 30], BLUE, [child, text('Go', x + 24, 17)]);
    const tree: PageTree = { ...TREE, root: { ...TREE.root, children: [row(0, 10, icon(1, 'M 0 0 L 16 0 L 16 16 Z', 14)), row(2, 140, icon(3, 'M 0 0 L 16 16 L 0 16 Z', 144))] } };
    const uses: ComponentUse[] = [
      { component: 'NavLink', props: {} },
      { component: 'Icon', props: { icon: 'home' } },
      { component: 'NavLink', props: {} },
      { component: 'Icon', props: { icon: 'tasks' } }
    ];
    const doc = codePlan(tree, uses, nid)!.plan.items[0].doc;

    expect(mainsNamed(doc, 'Icon').map(([, c]) => c.component!.variant)).toEqual(expect.arrayContaining([{ icon: 'home' }, { icon: 'tasks' }]));
  });

  it('due componenti con la stessa radice: l\'esterno è un main che contiene un\'istanza dell\'interno', () => {
    const tree: PageTree = { ...TREE, root: { ...TREE.root, children: [framed(0, [10, 10, 80, 30], BLUE, [text('Save', 20, 17)]), framed(2, [100, 10, 80, 30], BLUE, [text('Undo', 110, 17)])] } };
    const uses: ComponentUse[] = [
      { component: 'Tooltip', props: {} },
      { component: 'Button', props: { children: 'Save' }, shares: 0 },
      { component: 'Tooltip', props: {} },
      { component: 'Button', props: { children: 'Undo' }, shares: 2 }
    ];
    const doc = codePlan(tree, uses, nid)!.plan.items[0].doc;
    const [tooltipId, tooltip] = mainsNamed(doc, 'Tooltip')[0];
    const [buttonId] = mainsNamed(doc, 'Button')[0];

    expect(tooltip.tracks.flatMap((t) => t.clips as MotionClip[]).some((c) => compOf(c) === buttonId)).toBe(true);
    expect(hostsOf(doc, tooltipId)).toHaveLength(2);
    expect(hostsOf(doc, tooltipId).map((h) => shownTexts(doc, tooltip, h)[0]).sort()).toEqual(['Save', 'Undo']);
  });

  it('ogni insieme di varianti va sulla pagina Components, e le istanze della pagina vi rimandano', () => {
    const made = codePlan(TREE, USES, nid)!;

    expect(made.sets.map((s) => s.name).sort()).toEqual(['Button', 'Card', 'CardTitle']);
    expect(Object.keys(made.homes[0] ?? {})).toHaveLength(4);
  });

  it('la prop di testo del codice diventa la proprietà del main, col suo nome', () => {
    const doc = docOf();
    const [, title] = mainsNamed(doc, 'CardTitle')[0];
    const target = title.component!.properties!.children.target;

    expect(title.component!.properties!.children).toMatchObject({ kind: 'text', default: 'Revenue' });
    expect(title.tracks.flatMap((t) => t.clips).find((c) => c.id === target)?.props.text).toBe('Revenue');
  });

  it('un main in auto layout resta dove stava, anche se un suo figlio esce dal riquadro', () => {
    const header: RestNode = { id: nid(), type: 'FRAME', name: 'header', absoluteBoundingBox: box(0, 0, 400, 40), fills: [{ type: 'SOLID', color: GREY }] };
    const badge: RestNode = { id: nid(), type: 'FRAME', name: 'badge', absoluteBoundingBox: box(380, 30, 20, 20), fills: [{ type: 'SOLID', color: BLUE }] };
    const card = framed(0, [0, 40, 400, 100], GREY, [text('Title', 20, 60), badge]);
    const column = { layoutMode: 'VERTICAL', itemSpacing: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN' };
    const tree: PageTree = { ...TREE, root: { ...TREE.root, ...column, children: [header, card] } };
    const doc = codePlan(tree, [{ component: 'Card', props: {} }], nid)!.plan.items[0].doc;

    expect(mainsNamed(doc, 'Card')).toHaveLength(1);
    expect(textAt(doc, tree, 'Title')).toEqual({ x: 20, y: 60 });
  });

  it('componenti annidati in profondità costano lavoro lineare, non esponenziale', () => {
    const DEPTH = 14;
    const nesting = (x: number, base: number, level = 0): RestNode =>
      framed(base + level, [x + level * 2, 10 + level * 10, 150 - level * 4, 280 - level * 12], level % 2 ? GREY : WHITE, [text(`L${level}`, x + level * 2 + 4, 12 + level * 10), ...(level + 1 < DEPTH ? [nesting(x, base, level + 1)] : [])]);
    const tree: PageTree = { ...TREE, root: { ...TREE.root, children: [nesting(10, 0), nesting(200, DEPTH)] } };
    const uses = [...Array(2 * DEPTH).keys()].map((i) => ({ component: `Level${i % DEPTH}`, props: {} }));
    let made = 0;
    const plan = codePlan(tree, uses, () => `n${++made}`)!;

    expect(mainsNamed(plan.plan.items[0].doc, 'Level0')).toHaveLength(1);
    expect(made).toBeLessThan(DEPTH * 20);
  });
});

describe('a simplified import still syncs with its source', () => {
  const FILE = 'src/routes/+page.svelte';
  const spot = (line: number, tag: string) => ({ at: `${FILE}:${line}:2`, tag, cls: '' });
  const ink = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }];
  const stack = { layoutMode: 'VERTICAL', itemSpacing: 20, paddingTop: 20, paddingRight: 20, paddingBottom: 20, paddingLeft: 20, primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED' };

  const pageAt = (shift: number): PageTree => {
    const title: RestNode = { id: nid(), type: 'TEXT', name: 'Ciao mondo', characters: 'Ciao mondo', absoluteBoundingBox: box(20, 20, 360, 40), fills: ink, textAutoResize: 'HEIGHT', style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 32, lineHeightPx: 40 }, source: spot(6 + shift, 'h1') };
    const intro: RestNode = { id: nid(), type: 'TEXT', name: 'Benvenuta', characters: 'Benvenuta', absoluteBoundingBox: box(30, 90, 340, 20), fills: ink, style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 14, lineHeightPx: 20 }, source: spot(7 + shift, 'p') };
    const card: RestNode = { id: nid(), type: 'FRAME', name: 'div', absoluteBoundingBox: box(20, 80, 360, 100), fills: [{ type: 'SOLID', color: GREY }], ...stack, paddingTop: 10, paddingLeft: 10, paddingRight: 10, paddingBottom: 70, children: [intro], source: spot(9 + shift, 'div') };
    const wrapper: RestNode = { id: nid(), type: 'FRAME', name: 'div', absoluteBoundingBox: box(20, 80, 360, 100), fills: [], children: [card], source: spot(8 + shift, 'div') };
    const section: RestNode = { id: nid(), type: 'FRAME', name: 'section', absoluteBoundingBox: box(0, 0, 400, 200), fills: [], ...stack, children: [title, wrapper], source: spot(5 + shift, 'section') };
    return { title: 'Home', url: 'http://localhost:5174/', width: 400, height: 300, truncated: false, root: { id: nid(), type: 'FRAME', name: 'Home', absoluteBoundingBox: box(0, 0, 400, 300), fills: [{ type: 'SOLID', color: WHITE }], children: [section] } };
  };

  const imported = (shift: number) => codePlan(pageAt(shift), [], nid)!.plan.items[0].doc;
  const at = (doc: MotionDoc, line: number) => allClips(doc).find((c) => c.source?.at === `${FILE}:${line}:2`);
  const renamed = (doc: MotionDoc, line: number, text: string) => mapClips(doc, (c) => (c.source?.at === `${FILE}:${line}:2` ? LOOK[LookKey.Text].write(c, text, minSideOf(doc)) : c));

  it('the wrapper around the card is gone, the card and the title keep their own lines', () => {
    const doc = imported(0);

    expect(at(doc, 8)).toBeUndefined();
    expect(at(doc, 9)).toBeDefined();
    expect(at(doc, 6)).toMatchObject({ component: 'Text' });
  });

  it('a text edited on the canvas is written back to its own element', () => {
    const edits = editsOf(renamed(imported(0), 6, 'Ciao traidue'));

    expect(edits.map((e) => [e.at.line, e.look])).toEqual([[6, { text: 'Ciao traidue' }]]);
  });

  it('Pull carries the edit to the same element after the lines moved', () => {
    const done = rebased(renamed(imported(0), 6, 'Ciao traidue'), imported(1));

    expect(done.carried).toBe(1);
    expect(done.conflicts).toEqual([]);
    expect(at(done.doc, 7)?.props.text).toBe('Ciao traidue');
  });
});
