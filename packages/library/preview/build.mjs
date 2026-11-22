import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8');
const THEMES = ['light', 'dark'];
const ID_ATTRIBUTES = /\b(id|for|aria-controls|aria-labelledby)="([^"]+)"/g;

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
<style>
${read('tokens.css')}
body{margin:0;padding:1rem;background:#808080;font-family:system-ui,sans-serif}
.item{max-width:80rem;margin:0 auto 3rem}
.item > h2{margin:0 0 .75rem;color:#fff;font-size:1rem}
.item > h2 small{margin-left:.5rem;font-weight:400;opacity:.7}
.frame{margin-bottom:1rem;overflow:hidden;border-radius:10px}
${styles}
</style>
</head>
<body>
${sections}
</body>
</html>
`;

writeFileSync(join(ROOT, 'preview', 'index.html'), html);
console.log(`${items.length} items`);
