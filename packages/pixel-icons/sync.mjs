import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PixelIcon, pixelSvg } from './src/pixel.ts';
import { COPIES } from './targets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PREVIEW_SIZE = 8;

for (const { source, to } of COPIES) {
  mkdirSync(dirname(join(ROOT, to)), { recursive: true });
  copyFileSync(join(HERE, source), join(ROOT, to));
}

const cells = Object.entries(PixelIcon)
  .map(([key, name]) => `<figure>${pixelSvg(name, PREVIEW_SIZE)}<figcaption><b>${name}</b><br>PixelIcon.${key}</figcaption></figure>`)
  .join('\n');

writeFileSync(
  join(HERE, 'preview.html'),
  `<!doctype html>
<meta charset="utf-8">
<title>Feega pixel icons</title>
<style>body{margin:32px;background:#141414;color:#f0eee9;font:13px system-ui}main{display:grid;grid-template-columns:repeat(auto-fill,150px);gap:24px}figure{margin:0;display:flex;flex-direction:column;gap:8px}figcaption{color:#8a8780}</style>
<main>
${cells}
</main>
`
);
