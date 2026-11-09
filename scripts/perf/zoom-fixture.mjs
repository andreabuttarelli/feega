import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DOCS = ['asteroids', 'easing', 'generative', 'post', 'supasito'].map((name) => JSON.parse(readFileSync(`${ROOT}tests/e2e/fixtures/gpu-docs/${name}.json`, 'utf8')));
const FRAMES = 60;
const COLUMNS = 10;
const CELL = { width: 2200, height: 1600 };
const NOTES_PER_FRAME = 2;
const NOTE_OFFSET_Y = 1400;
const IMAGES = 40;
const IMAGE_PX = 1024;
const IMAGE_ROW_Y = Math.ceil(FRAMES / COLUMNS) * CELL.height;
const IMAGE_CELL = 1200;
const PROJECT_ID = '00000000-0000-4000-8000-0000000be001';
const CANVAS_ID = '00000000-0000-4000-8000-0000000be002';
const EXPORTED_AT = '2026-11-09T00:00:00.000Z';

const uuid = (kind, i) => `00000000-0000-4000-${kind}-${String(i).padStart(12, '0')}`;

const formatOf = (doc) => (doc.width === doc.height ? '1:1' : doc.width > doc.height ? '16:9' : '4:5');

function frame(i) {
  const doc = DOCS[i % DOCS.length];
  const at = { x: (i % COLUMNS) * CELL.width, y: Math.floor(i / COLUMNS) * CELL.height };
  return {
    node: { id: uuid('8001', i), type: 'motion', displayName: `Frame ${i + 1}`, position: { ...at, z: i }, size: { width: doc.width, height: doc.height }, data: { format: formatOf(doc), docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, interactive: false } },
    head: { version: 1, doc },
    at
  };
}

function note(i, at, n) {
  return { id: uuid('8002', i * NOTES_PER_FRAME + n), type: 'text', displayName: null, position: { x: at.x + n * 1000, y: at.y + NOTE_OFFSET_Y, z: FRAMES + i }, size: { width: 900, height: 160 }, data: { text: `Brief ${i + 1}.${n + 1}: hero copy, launch week, three variants for the paid social test.` } };
}

async function picture(i) {
  const pixels = Buffer.alloc(IMAGE_PX * IMAGE_PX * 3);
  for (let y = 0; y < IMAGE_PX; y++) {
    for (let x = 0; x < IMAGE_PX; x++) {
      const at = (y * IMAGE_PX + x) * 3;
      pixels[at] = (x * (i + 3)) & 255;
      pixels[at + 1] = (y * (i + 5)) & 255;
      pixels[at + 2] = ((x ^ y) * 7 + i * 31) & 255;
    }
  }
  return new Uint8Array(await sharp(pixels, { raw: { width: IMAGE_PX, height: IMAGE_PX, channels: 3 } }).png().toBuffer());
}

function image(i) {
  const assetId = uuid('8003', i);
  const file = `assets/bench-${i}.png`;
  const node = { id: uuid('8004', i), type: 'image', displayName: null, position: { x: (i % COLUMNS) * CELL.width, y: IMAGE_ROW_Y + Math.floor(i / COLUMNS) * IMAGE_CELL, z: FRAMES * 2 + i }, size: { width: IMAGE_PX, height: IMAGE_PX }, data: { prompt: `Product still ${i + 1}`, assetId, mimeType: 'image/png' } };
  const asset = { id: assetId, type: 'image', mimeType: 'image/png', width: IMAGE_PX, height: IMAGE_PX, durationS: null, content: null, url: null, file };
  return { node, asset, file };
}

export function zoomFixture() {
  const frames = Array.from({ length: FRAMES }, (_, i) => frame(i));
  const notes = frames.flatMap((f, i) => Array.from({ length: NOTES_PER_FRAME }, (_, n) => note(i, f.at, n)));
  const images = Array.from({ length: IMAGES }, (_, i) => image(i));
  const canvas = { nodes: [...frames.map((f) => f.node), ...notes, ...images.map((m) => m.node)], connections: [], heads: Object.fromEntries(frames.map((f) => [f.node.id, f.head])), assets: images.map((m) => m.asset) };
  const manifest = { format: 'feega', version: 1, exportedAt: EXPORTED_AT, canvasName: 'zoom bench', source: { projectId: PROJECT_ID, canvasId: CANVAS_ID } };
  return { manifest, canvas, files: images.map((m) => m.file) };
}

export const ZOOM_FIXTURE_PLACE = { projectId: PROJECT_ID, canvasId: CANVAS_ID };
export const ZOOM_FIXTURE_CENTRE = { x: (COLUMNS * CELL.width) / 2, y: IMAGE_ROW_Y };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { manifest, canvas, files } = zoomFixture();
  const blobs = Object.fromEntries(await Promise.all(files.map(async (file, i) => [file, await picture(i)])));
  writeFileSync(process.argv[2], zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'canvas.json': strToU8(JSON.stringify(canvas)), ...blobs }));
}
