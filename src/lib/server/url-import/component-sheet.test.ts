import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import { compBox } from '$lib/motion/comp-frame';
import type { PageOutline } from './page-outline';
import type { PageTree } from './page-tree';
import { FULL_SHAPE, urlPlan } from './url-doc';

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

function planOf(name: string) {
  const tree = { ...read<PageTree>(`./fixtures/${name}.json`), outline: read<PageOutline>(`./fixtures/outlines/${name}.json`) };
  let n = 0;
  return urlPlan(tree, () => `id${++n}`, undefined, {}, FULL_SHAPE)!;
}

const mainsIn = (set: PlanItem) => Object.entries(set.doc.comps).filter(([, c]) => c.component);

describe('each main or set gets its own frame, sized to its content', () => {
  it.each(['linear', 'vercel'])('%s: no Components frame sits beside the page any more', (name) => {
    expect(planOf(name).plan.items.some((item) => item.name === 'Components')).toBe(false);
  });

  it.each(['linear', 'vercel'])('%s: every main lands inside its own set frame', (name) => {
    for (const set of planOf(name).sets) {
      for (const [, comp] of mainsIn(set)) {
        const box = compBox(comp, set.doc)!;
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(set.doc.width + 1);
        expect(box.bottom).toBeLessThanOrEqual(set.doc.height + 1);
      }
    }
  });

  it('linear: a set frame is far smaller than the old sheet', () => {
    const { plan, sets } = planOf('linear');
    const page = plan.items[0].doc;

    expect(sets.length).toBeGreaterThan(1);
    expect(Math.max(...sets.map((s) => s.doc.width * s.doc.height))).toBeLessThan((page.width * page.height) / 4);
  });

  it('linear: variants of one set share one frame and every page main has a home', () => {
    const { plan, sets, homes } = planOf('linear');
    const setNames = sets.map((s) => new Set(mainsIn(s).map(([, c]) => c.component!.set ?? c.component!.name)));
    const pageMains = plan.items.flatMap((item) => Object.entries(item.doc.comps).filter(([, c]) => c.component).map(([id]) => id));

    expect(setNames.every((names) => names.size === 1)).toBe(true);
    expect(new Set(Object.values(homes).flatMap((h) => Object.keys(h)))).toEqual(new Set(pageMains));
  });

  it('linear: set frames do not overlap on the Components page', () => {
    const boxes = planOf('linear').sets.map((s) => ({ l: s.centre.x - s.size.width / 2, t: s.centre.y - s.size.height / 2, r: s.centre.x + s.size.width / 2, b: s.centre.y + s.size.height / 2 }));
    const overlaps = boxes.some((a, i) => boxes.some((b, j) => i < j && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b));

    expect(overlaps).toBe(false);
  });
});
