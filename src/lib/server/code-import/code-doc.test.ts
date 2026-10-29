import { describe, expect, it } from 'vitest';
import { compOf, type MotionClip, type MotionComp, type MotionDoc } from '@feega/motion-core/motion/doc';
import { overridden } from '@feega/motion-core/motion/precomp';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';
import { codePlan } from './code-doc';

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

  it('la prop di testo del codice diventa la proprietà del main, col suo nome', () => {
    const doc = docOf();
    const [, title] = mainsNamed(doc, 'CardTitle')[0];
    const target = title.component!.properties!.children.target;

    expect(title.component!.properties!.children).toMatchObject({ kind: 'text', default: 'Revenue' });
    expect(title.tracks.flatMap((t) => t.clips).find((c) => c.id === target)?.props.text).toBe('Revenue');
  });
});
