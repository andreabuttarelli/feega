import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardsOf } from '../../src/lib/server/code-import/boards';
import { codePlan } from '../../src/lib/server/code-import/code-doc';
import { designed, designOf, withBoard } from '../../src/lib/server/code-import/design-system';
import { folderSource } from '../../src/lib/server/code-import/folder-source';
import { codeCapturedIn, type CapturedApp } from '../../src/lib/server/code-import/fidelity-apps';
import { BASE_CONDITIONS } from '../../src/lib/server/code-import/render-conditions';
import { compacted } from './compact';
import { isDemo, itemFor } from './names';
import { durableImages, showsImagePlaceholder } from './images';
import { imagesFilled } from '../../src/lib/canvas/figma/images';

type Catalog = { publicBase?: string; items: { name: string; title: string; description: string }[]; skipped?: { name: string; reason: string }[] };

const IMAGE_LOST = 'not imported: an image would insert as a grey placeholder';

const [library, NAME, given] = process.argv.slice(2);
if (!library || !NAME) {
  throw new Error('usage: snapshot.ts <library> <Group> [capture label]');
}
const label = given ?? `${library}-lib`;
const LIBRARY = join(import.meta.dirname, '../../libraries', library);
const OUT = join(import.meta.dirname, `../../src/lib/motion/template/${library}/${library}-doc.json`);
const INDEX = join(import.meta.dirname, `../../src/lib/motion/template/${library}/${library}-index.json`);

const app = JSON.parse(readFileSync(join(codeCapturedIn(label), library, 'capture.json'), 'utf8')) as CapturedApp;
const design = await designOf(folderSource(LIBRARY).read(''));
const captures = app.pages.map((p) => ({ label: p.label, tree: p.tree, uses: p.uses }));
const boards = boardsOf(NAME, design ? withBoard(design, NAME, captures) : captures);
let n = 0;
const planned = codePlan(boards.tree, boards.uses, () => `a${(++n).toString(36)}`);
if (!planned) {
  throw new Error(`the ${NAME} capture planned nothing`);
}

const width = boards.tree.root.absoluteBoundingBox?.width ?? boards.tree.width;
const plan = design ? designed(design, planned, { repo: NAME, base: BASE_CONDITIONS, boards: {}, captures, width }).plan : planned;
const catalog = JSON.parse(readFileSync(join(LIBRARY, 'catalog.json'), 'utf8')) as Catalog;
const images = durableImages(plan.images, catalog.publicBase);
const taken = new Set<string>();
const lost: string[] = [];
const ranked = [...plan.sets].sort((a, b) => Number(isDemo(a.name)) - Number(isDemo(b.name)));
const sets = ranked.flatMap((s) => {
  const item = itemFor(catalog.items, s.name);
  if (!item || taken.has(item.name)) {
    return [];
  }
  taken.add(item.name);
  const doc = imagesFilled(s.doc, s.images, images);
  if (showsImagePlaceholder(doc)) {
    lost.push(item.name);
    return [];
  }
  return [{ name: item.title, slug: item.name, description: item.description, size: s.size, doc: compacted(doc) }];
});
writeFileSync(OUT, JSON.stringify(sets));
writeFileSync(INDEX, `${JSON.stringify(sets.map(({ slug, name, description }) => ({ slug, name, description })), null, 2)}\n`);
if (lost.length) {
  const gone = new Set(lost);
  const skipped = [...(catalog.skipped ?? []), ...lost.map((name) => ({ name, reason: IMAGE_LOST }))];
  writeFileSync(join(LIBRARY, 'catalog.json'), `${JSON.stringify({ ...catalog, items: catalog.items.filter((i) => !gone.has(i.name)), skipped }, null, 2)}\n`);
}
console.log(`${sets.length} component sets written to ${OUT}; left out for lost images: ${lost.join(' ') || 'none'}`);
