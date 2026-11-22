import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8');
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Fragment+Mono&display=swap';
const THEMES = ['light', 'dark'];
const ID_ATTRIBUTES = /\b(id|for|name|aria-controls|aria-labelledby|aria-describedby)="([^"]+)"/g;

const ids = readdirSync(join(ROOT, 'items'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const items = ids.map((id) => ({
  manifest: JSON.parse(read('items', id, 'manifest.json')),
  markup: read('items', id, 'html', 'index.html'),
  css: read('items', id, 'html', 'style.css')
}));

const styles = [...new Set(items.flatMap((item) => item.css.split('\n')))].join('\n');

function frame(item, theme) {
  const suffix = theme === 'light' ? '' : `-${theme}`;
  const markup = item.markup.replace(ID_ATTRIBUTES, (_, name, value) => `${name}="${value}${suffix}"`);
  return `<div class="frame" data-theme="${theme}" data-frame="${item.manifest.id}-${theme}">${markup}</div>`;
}

const sections = items
  .map(
    (item) => `<section class="item" id="${item.manifest.id}">
  <h2>${item.manifest.name} <small>${item.manifest.category} / ${item.manifest.tags.join(', ')}</small></h2>
  ${THEMES.map((theme) => frame(item, theme)).join('\n  ')}
</section>`
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Feega library, basic</title>
<link rel="stylesheet" href="${FONTS}" />
<style>
${read('tokens.css')}
body{margin:0;padding:2rem 1rem;background:#0b0b0b;color:#f0eee9;font-family:"Inter Tight",system-ui,sans-serif;letter-spacing:-0.02em}
.intro{max-width:80rem;margin:0 auto 4rem}
.intro h1{margin:0;font-size:clamp(3rem,9vw,7rem);font-weight:500;line-height:.9;letter-spacing:-0.05em}
.intro p{margin:1rem 0 0;color:#a3a09a;font-size:1.125rem}
.item{max-width:80rem;margin:0 auto 4rem}
.item > h2{display:flex;align-items:baseline;gap:.75rem;margin:0 0 1rem;font-size:1.5rem;font-weight:500;letter-spacing:-0.04em}
.item > h2 small{font-family:"Fragment Mono",monospace;font-size:.75rem;font-weight:400;letter-spacing:0;color:#6e6b66;text-transform:uppercase}
.frame{position:relative;margin-bottom:1rem;overflow:hidden;border-radius:16px;box-shadow:0 0 0 1px #232323}
${styles}
</style>
</head>
<body>
<header class="intro"><h1>feega library</h1><p>${items.length} free items. Svelte, React, Vue, Astro and HTML. Light and dark.</p></header>
${sections}
</body>
</html>
`;

writeFileSync(join(ROOT, 'preview', 'index.html'), html);
console.log(`${items.length} items`);
