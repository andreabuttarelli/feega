import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { RUIXEN_GROUP, RUIXEN_TEMPLATES } from './ruixen';
import { groupTitle } from './library-groups';
import { catalogue } from './catalogue';
import { templateCard } from './cards';

const pinned = JSON.parse(readFileSync('libraries/ruixen/catalog.json', 'utf8')) as { items: { name: string; tier: string }[] };
const free = new Set(pinned.items.filter((i) => i.tier === 'free').map((i) => i.name));

describe('the built-in Ruixen library', () => {
  it('lists its components under the Ruixen group of the component library', () => {
    expect(RUIXEN_TEMPLATES.length).toBeGreaterThan(100);
    expect(new Set(catalogue(RUIXEN_TEMPLATES).map(groupTitle))).toEqual(new Set([RUIXEN_GROUP]));
  });

  it('holds only components of the free, open-source registry', () => {
    expect(RUIXEN_TEMPLATES.map((e) => e.id.slice('builtin:ruixen-'.length)).filter((slug) => !free.has(slug))).toEqual([]);
  });

  it('gives every component a doc that parses', () => {
    expect(RUIXEN_TEMPLATES.filter((e) => !parseMotionDoc(e.template.doc).ok).map((e) => e.id)).toEqual([]);
  });

  it('gives every component a card agents plan from', () => {
    expect(RUIXEN_TEMPLATES.filter((e) => !templateCard(e.id)).map((e) => e.id)).toEqual([]);
  });
});
