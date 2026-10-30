import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { PageOutline } from './page-outline';
import type { PageTree } from './page-tree';
import { FULL_SHAPE, urlPlan } from './url-doc';

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

function pageOf(name: string): MotionDoc {
  const tree = { ...read<PageTree>(`./fixtures/${name}.json`), outline: read<PageOutline>(`./fixtures/outlines/${name}.json`) };
  let n = 0;
  return urlPlan(tree, () => `id${++n}`, undefined, {}, FULL_SHAPE)!.plan.items[0].doc;
}

const mainsNamed = (doc: MotionDoc, name: string) => Object.values(doc.comps).filter((c) => c.component?.name === name);

describe('imported sites become a component kit', () => {
  it('vercel: every button main has a Label property, even when its text is nested', () => {
    const buttons = mainsNamed(pageOf('vercel'), 'Button');

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.map((c) => Object.keys(c.component!.properties ?? {}))).toEqual(buttons.map(() => expect.arrayContaining(['Label'])));
  });
});
