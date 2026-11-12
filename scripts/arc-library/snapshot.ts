import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardsOf } from '../../src/lib/server/code-import/boards';
import { codePlan } from '../../src/lib/server/code-import/code-doc';
import { designed, designOf, withBoard } from '../../src/lib/server/code-import/design-system';
import { folderSource } from '../../src/lib/server/code-import/folder-source';
import { codeCapturedIn, type CapturedApp } from '../../src/lib/server/code-import/fidelity-apps';
import { BASE_CONDITIONS } from '../../src/lib/server/code-import/render-conditions';
import { compacted } from './compact';
import type { Catalog } from './registry';

const LIBRARY = join(import.meta.dirname, '../../libraries/arc');
const OUT = join(import.meta.dirname, '../../src/lib/motion/template/arc/arc-doc.json');
const INDEX = join(import.meta.dirname, '../../src/lib/motion/template/arc/arc-index.json');
const NAME = 'Arc';
const label = process.argv[2] ?? 'arc-lib';

const app = JSON.parse(readFileSync(join(codeCapturedIn(label), 'arc', 'capture.json'), 'utf8')) as CapturedApp;
const design = await designOf(folderSource(LIBRARY).read(''));
const captures = app.pages.map((p) => ({ label: p.label, tree: p.tree, uses: p.uses }));
const boards = boardsOf(NAME, design ? withBoard(design, NAME, captures) : captures);
let n = 0;
const planned = codePlan(boards.tree, boards.uses, () => `a${(++n).toString(36)}`);
if (!planned) {
  throw new Error('the Arc capture planned nothing');
}

const width = boards.tree.root.absoluteBoundingBox?.width ?? boards.tree.width;
const plan = design ? designed(design, planned, { repo: NAME, base: BASE_CONDITIONS, boards: {}, captures, width }).plan : planned;
const catalog = JSON.parse(readFileSync(join(LIBRARY, 'catalog.json'), 'utf8')) as Catalog;
const pascal = (name: string) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
const described = new Map(catalog.items.map((i) => [pascal(i.name), i]));
const sets = plan.sets.flatMap((s) => {
  const item = described.get(s.name);
  return item ? [{ name: item.title, slug: item.name, description: item.description, size: s.size, doc: compacted(s.doc) }] : [];
});
writeFileSync(OUT, JSON.stringify(sets));
writeFileSync(INDEX, `${JSON.stringify(sets.map(({ slug, name, description }) => ({ slug, name, description })), null, 2)}\n`);
console.log(`${sets.length} component sets written to ${OUT}`);
