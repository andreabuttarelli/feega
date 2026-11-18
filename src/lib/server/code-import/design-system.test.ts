import { describe, expect, it } from 'vitest';
import type { MotionClip } from '@feega/motion-core/motion/doc';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { codePlan } from './code-doc';
import { designed, designOf, withBoard } from './design-system';
import { DESIGN_BOARD } from './design-board';
import { BASE_CONDITIONS } from './render-conditions';
import { frameEdits } from './token-write';

let ids = 0;
const nid = () => `n${++ids}`;
const muted = { r: 0x77 / 255, g: 0x77 / 255, b: 0x77 / 255, a: 1 };
const badge = (x: number): RestNode => ({ id: nid(), type: 'FRAME', name: 'Badge', use: 0, absoluteBoundingBox: { x, y: 10, width: 80, height: 30 }, fills: [{ type: 'SOLID', color: muted }], source: { at: 'src/Badge.svelte:3:1', tag: 'span', cls: 'bg-muted' } });
const tree: PageTree = { title: '/', url: 'http://127.0.0.1:5000/', width: 400, height: 200, truncated: false, root: { id: nid(), type: 'FRAME', name: '/', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [badge(10), { ...badge(120), use: 1 }] } };

describe('designed', () => {
  it('i main portati sulla pagina Componenti restano legati ai token e la loro pagina ha le variabili', async () => {
    const design = (await designOf(fixture('tailwind4')))!;
    const plan = codePlan(tree, [{ component: 'Badge', props: {} }, { component: 'Badge', props: {} }], nid)!;
    const home = { ...plan, sets: plan.plan.items.map((item) => ({ ...item, doc: { ...item.doc, tracks: [] } })) };

    const done = designed(design, home, { repo: 'app', base: BASE_CONDITIONS, boards: {}, captures: [{ label: '/', tree, uses: [] }], width: 400 });

    const [set] = done.plan.sets;
    const mains = Object.values(set.doc.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips as MotionClip[]));
    expect(mains.some((c) => c.bind?.fill === 'app Colors/muted')).toBe(true);
    expect(set.doc.variables?.['app Colors']).toBeDefined();
  });
});

describe('designed, a page split into frames of different sizes', () => {
  it('every frame reads its text styles at the same pixel size, and none has edits to push', async () => {
    const design = (await designOf(fixture('typescale')))!;
    const plan = codePlan(tree, [], nid)!;
    const slice = plan.plan.items[0];
    const split = { ...plan, plan: { ...plan.plan, items: [{ ...slice, doc: { ...slice.doc, width: 1280, height: 160 } }, { ...slice, doc: { ...slice.doc, width: 1280, height: 16384 } }] } };

    const done = designed(design, split, { repo: 'app', base: BASE_CONDITIONS, boards: {}, captures: [{ label: '/', tree, uses: [] }], width: 1280 });

    const px = done.plan.plan.items.map(({ doc }) => {
      const hero = doc.styles?.['app Text/hero'] as { size: number };
      return Math.round(hero.size * Math.min(doc.width, doc.height));
    });
    expect(px).toEqual([48, 48]);
    for (const { doc } of done.plan.plan.items) {
      expect((await frameEdits(doc, done.map, fixture('typescale'))).files).toEqual([]);
    }
  });
});

describe('withBoard', () => {
  it('la tavola mostra gli stili di testo del repo, non solo le ombre', async () => {
    const design = (await designOf(fixture('typescale')))!;

    const [board] = withBoard(design, 'app', [{ label: '/', tree: { ...tree, width: 1280 }, uses: [] }]);

    const names = (board.tree.root.children ?? []).map((n) => n.name);
    expect(board.label).toBe(DESIGN_BOARD);
    expect(names).toEqual(expect.arrayContaining(['Text', 'app Text/hero', 'Shadow', 'app Shadow/card']));
  });
});
