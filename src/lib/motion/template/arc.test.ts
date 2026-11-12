import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { ARC_GROUP, ARC_TEMPLATES } from './arc';
import { groupTitle } from './library-groups';
import { catalogue } from './catalogue';

const pinned = JSON.parse(readFileSync('libraries/arc/catalog.json', 'utf8')) as { items: { name: string; tier: string }[] };
const free = new Set(pinned.items.filter((i) => i.tier === 'free').map((i) => i.name));

describe('the built-in Arc library', () => {
  it('lists its components under the Arc group of the component library', () => {
    expect(ARC_TEMPLATES.length).toBeGreaterThan(100);
    expect(new Set(catalogue(ARC_TEMPLATES).map(groupTitle))).toEqual(new Set([ARC_GROUP]));
  });

  it('holds only components of the free tier', () => {
    expect(ARC_TEMPLATES.map((e) => e.id.split('arc-')[1]).filter((slug) => !free.has(slug))).toEqual([]);
  });

  it('gives every component a doc that parses', () => {
    expect(ARC_TEMPLATES.filter((e) => !parseMotionDoc(e.template.doc).ok).map((e) => e.id)).toEqual([]);
  });

  it('carries the Arc variable collections, accents included', () => {
    const button = ARC_TEMPLATES.find((e) => e.template.name === 'Arc · Button')!;
    expect(Object.keys(button.template.doc.variables ?? {})).toEqual(expect.arrayContaining(['Arc Palette', 'Arc Accent']));
  });
});
