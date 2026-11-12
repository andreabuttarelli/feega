import { readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const ROW_GAP = 4000;
const CANVAS_FILE = 'canvas.json';

function layers(doc) {
  let count = 0;
  const open = [doc];
  while (open.length) {
    const at = open.pop();
    if (at && typeof at === 'object') {
      count += typeof at.component === 'string' ? 1 : 0;
      open.push(...Object.values(at));
    }
  }
  return count;
}

function copyId(id, row) {
  return `${row.toString(16).padStart(8, '0')}${id.slice(8)}`;
}

export function scaled(canvas, nodes) {
  const perRow = canvas.nodes.reduce((sum, n) => sum + layers(canvas.heads[n.id]?.doc), 0);
  const rows = Math.max(1, Math.ceil(nodes / perRow));
  const top = Math.min(...canvas.nodes.map((n) => n.position.y));
  const bottom = Math.max(...canvas.nodes.map((n) => n.position.y + n.size.height));
  const pitch = bottom - top + ROW_GAP;
  const copies = Array.from({ length: rows }, (_, row) => canvas.nodes.map((n) => ({ ...n, id: copyId(n.id, row), position: { ...n.position, y: n.position.y + row * pitch } })));
  const heads = Object.fromEntries(copies.flat().map((n, i) => [n.id, canvas.heads[canvas.nodes[i % canvas.nodes.length].id]]));
  return { canvas: { ...canvas, nodes: copies.flat(), heads }, layers: rows * perRow };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [source, out, nodes] = process.argv.slice(2);
  const files = unzipSync(readFileSync(source));
  const { canvas, layers: total } = scaled(JSON.parse(strFromU8(files[CANVAS_FILE])), Number(nodes));
  writeFileSync(out, zipSync({ ...files, [CANVAS_FILE]: strToU8(JSON.stringify(canvas)) }));
  console.log(`${out}: ${canvas.nodes.length} frames, ${total} layers`);
}
