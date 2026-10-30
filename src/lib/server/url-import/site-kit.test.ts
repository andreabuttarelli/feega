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

const mainsNamed = (doc: MotionDoc, name: string) => Object.values(doc.comps).filter((c) => c.component?.name.replace(/ \d+$/, '') === name);

describe('imported sites become a component kit', () => {
  it('vercel: every button main has a Label property, even when its text is nested', () => {
    const buttons = mainsNamed(pageOf('vercel'), 'Button');

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.map((c) => Object.keys(c.component!.properties ?? {}))).toEqual(buttons.map(() => expect.arrayContaining(['Label'])));
  });

  it('stripe: its call-to-action links are Button components with states', () => {
    const doc = pageOf('stripe');
    const labelOf = (c: MotionDoc['comps'][string]) => Object.values(c.component!.properties ?? {}).find((p) => p.kind === 'text')?.default;
    const start = Object.entries(doc.comps).find(([, c]) => c.component?.name.startsWith('Button') && labelOf(c) === 'Inizia ora');
    const set = start?.[1].component?.set ?? start?.[0];
    const states = Object.values(doc.comps).filter((c) => c.component && (c.component.set ?? '') === set).map((c) => c.component!.variant?.State);

    expect(mainsNamed(doc, 'Button').flatMap((c) => labelOf(c) ?? [])).toContain('Guarda ora');
    expect(states).toEqual(expect.arrayContaining(['Default', 'Hover', 'Pressed']));
  });
});
