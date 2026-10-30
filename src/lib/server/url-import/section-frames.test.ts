import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageOutline } from './page-outline';
import type { PageTree } from './page-tree';
import { sectionsOf } from './page-sections';
import { sectionFramed } from './section-frames';
import { windowed } from './page-window';

const FIXTURES = ['stripe', 'linear', 'vercel'];
const WHOLE = new Set(['TEXT', 'VECTOR']);
const AREA_SLACK = 1;

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

function sectionsFor(name: string) {
  const tree = read<PageTree>(`./fixtures/${name}.json`);
  const outline = read<PageOutline>(`./fixtures/outlines/${name}.json`);
  const shown = windowed(tree.root, { left: 0, top: 0, right: tree.width, bottom: tree.height })!;
  return { tree: { ...tree, root: shown }, sections: sectionsOf({ ...outline, height: tree.height }) };
}

const leavesOf = (n: RestNode): RestNode[] => (n.children?.length ? n.children.flatMap(leavesOf) : [n]);

const drawn = (n: RestNode) => JSON.stringify([n.type, n.characters ?? '', n.absoluteBoundingBox]);

const originOf = (id: string) => id.split('~')[0];

const area = (n: RestNode) => n.absoluteBoundingBox!.width * n.absoluteBoundingBox!.height;

describe('sectionFramed', () => {
  it.each(FIXTURES)('i figli diretti della pagina %s sono le sezioni, impilate dall\'alto', (name) => {
    const { tree, sections } = sectionsFor(name);
    const root = sectionFramed(tree.root, sections);

    expect(root.children!.map((c) => c.name)).toEqual(sections.map((s) => s.name));
    expect(root.children!.map((c) => c.absoluteBoundingBox!.y)).toEqual(sections.map((s) => s.top));
    expect(root.layoutMode).toBe('VERTICAL');
  });

  it.each(FIXTURES)('testi e icone di %s restano dove erano, uno per uno', (name) => {
    const { tree, sections } = sectionsFor(name);
    const before = leavesOf(tree.root).filter((n) => WHOLE.has(n.type)).map(drawn).sort();
    const after = leavesOf(sectionFramed(tree.root, sections)).filter((n) => WHOLE.has(n.type)).map(drawn).sort();

    expect(after).toEqual(before);
  });

  it.each(FIXTURES)('ogni altra forma di %s, se tagliata, si ricompone nella stessa scatola', (name) => {
    const { tree, sections } = sectionsFor(name);
    const before = new Map(leavesOf(tree.root).filter((n) => !WHOLE.has(n.type)).map((n) => [n.id, n]));
    const pieces = new Map<string, RestNode[]>();
    for (const leaf of leavesOf(sectionFramed(tree.root, sections)).filter((n) => !WHOLE.has(n.type) && !n.id.startsWith('section:'))) {
      pieces.set(originOf(leaf.id), [...(pieces.get(originOf(leaf.id)) ?? []), leaf]);
    }

    for (const [id, own] of before) {
      const b = own.absoluteBoundingBox!;
      const parts = pieces.get(id) ?? [];
      const inside = parts.every((p) => {
        const q = p.absoluteBoundingBox!;
        return q.x >= b.x && q.y >= b.y && q.x + q.width <= b.x + b.width + AREA_SLACK && q.y + q.height <= b.y + b.height + AREA_SLACK;
      });
      expect(inside, id).toBe(true);
      expect(Math.abs(parts.reduce((s, p) => s + area(p), 0) - area(own)), id).toBeLessThanOrEqual(AREA_SLACK);
    }
  });

  it.each(FIXTURES)('gli id di %s restano unici dopo il taglio', (name) => {
    const { tree, sections } = sectionsFor(name);
    const ids: string[] = [];
    const visit = (n: RestNode) => {
      ids.push(n.id);
      (n.children ?? []).forEach(visit);
    };
    visit(sectionFramed(tree.root, sections));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('una sezione senza niente dentro si unisce alla successiva, perché un frame vuoto sparisce', () => {
    const root: RestNode = { id: '1', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 300 }, children: [{ id: '2', type: 'TEXT', characters: 'Hi', absoluteBoundingBox: { x: 0, y: 150, width: 50, height: 20 } }] };
    const framed = sectionFramed(root, [{ name: 'Nav', top: 0, bottom: 100 }, { name: 'Hero', top: 100, bottom: 300 }]);

    expect(framed.children!.map((c) => [c.name, c.absoluteBoundingBox!.y, c.absoluteBoundingBox!.height])).toEqual([['Hero', 0, 300]]);
  });

  it('senza sezioni la pagina resta com\'è', () => {
    const { tree } = sectionsFor('vercel');

    expect(sectionFramed(tree.root, [])).toBe(tree.root);
  });
});
