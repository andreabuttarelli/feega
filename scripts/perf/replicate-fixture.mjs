import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const LIGHTEST = 3;
const GAP = 200;
const COLUMNS_PER_ROW = (count) => Math.ceil(Math.sqrt(count * 4));

export function replicate(canvas, count) {
  const weight = (n) => JSON.stringify(canvas.heads[n.id]).length;
  const sources = [...canvas.nodes].sort((a, b) => weight(a) - weight(b)).slice(0, LIGHTEST);
  const cell = { w: Math.max(...sources.map((n) => n.size.width)) + GAP, h: Math.max(...sources.map((n) => n.size.height)) + GAP };
  const columns = COLUMNS_PER_ROW(count);
  const nodes = [];
  const heads = {};
  for (let i = 0; i < count; i++) {
    const from = sources[i % sources.length];
    const id = randomUUID();
    nodes.push({ ...from, id, displayName: `${from.displayName} #${i + 1}`, position: { x: (i % columns) * cell.w, y: Math.floor(i / columns) * cell.h, z: 0 } });
    heads[id] = canvas.heads[from.id];
  }
  return { ...canvas, nodes, connections: [], heads };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [source, count, out] = process.argv.slice(2);
  const files = unzipSync(readFileSync(source));
  files['canvas.json'] = strToU8(JSON.stringify(replicate(JSON.parse(strFromU8(files['canvas.json'])), Number(count))));
  writeFileSync(out, zipSync(files));
}
