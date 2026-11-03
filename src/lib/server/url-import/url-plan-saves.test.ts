import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { urlPlan, FULL_SHAPE } from './url-doc';
import type { PageTree } from './page-tree';
import type { PageOutline } from './page-outline';

const fixture = <T>(path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}.json`, import.meta.url), 'utf8')) as T;

describe('a planned page saves', () => {
  it.each(['stripe', 'linear', 'vercel'])('%s: every frame and component set passes the doc schema', (name) => {
    const tree = { ...fixture<PageTree>(name), outline: fixture<PageOutline>(`outlines/${name}`) };
    let n = 0;
    const made = urlPlan(tree, () => `id${n++}`, undefined, {}, FULL_SHAPE, []);

    const refused = [...(made?.plan.items ?? []), ...(made?.sets ?? [])].map((item) => parseMotionDoc(item.doc)).flatMap((v) => (v.ok ? [] : [v.error]));
    expect(refused).toEqual([]);
  });
});
