import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PlanItem } from '$lib/canvas/figma/figma-doc';
import type { PageOutline } from './page-outline';
import type { PageTree } from './page-tree';
import { FULL_SHAPE, urlPlan } from './url-doc';

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

function sheetOf(name: string): PlanItem {
  const tree = { ...read<PageTree>(`./fixtures/${name}.json`), outline: read<PageOutline>(`./fixtures/outlines/${name}.json`) };
  let n = 0;
  return urlPlan(tree, () => `id${++n}`, undefined, {}, FULL_SHAPE)!.plan.items.find((item) => item.name === 'Components')!;
}

function extent(sheet: PlanItem) {
  const boxes = sheet.doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp').map((host) => {
    const roots = sheet.doc.comps[String(host.props.comp)].tracks.flatMap((t) => t.clips).filter((k) => !k.parent && Number(k.props.width) > 0);
    const right = Math.max(...roots.map((k) => (Number(k.props.x) + Number(k.props.width) / 2) * sheet.doc.width)) + Number(host.transform?.x ?? 0) * sheet.doc.width;
    const bottom = Math.max(...roots.map((k) => (Number(k.props.y) + Number(k.props.height) / 2) * sheet.doc.height)) + Number(host.transform?.y ?? 0) * sheet.doc.height;
    return { right, bottom };
  });
  return { width: Math.max(...boxes.map((b) => b.right)), height: Math.max(...boxes.map((b) => b.bottom)) };
}

describe('the mains on the Components frame form a compact grid', () => {
  it.each(['linear', 'vercel'])('%s: the mains stay inside the frame', (name) => {
    const sheet = sheetOf(name);
    const { width, height } = extent(sheet);

    expect(width).toBeLessThanOrEqual(sheet.doc.width);
    expect(height).toBeLessThanOrEqual(sheet.doc.height);
  });

  it('linear: the grid is not a thin column', () => {
    const { width, height } = extent(sheetOf('linear'));

    expect(Math.max(width / height, height / width)).toBeLessThan(2);
  });
});
