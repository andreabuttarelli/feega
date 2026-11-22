import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { css, jsx, indent } from './kit.mjs';
import { sections } from './sections.mjs';
import { app, components } from './app.mjs';
import { interactive } from './interactive.mjs';
import { variants } from './variants.mjs';
import { blocks } from './blocks.mjs';
import { pieces } from './pieces.mjs';
import { palette } from './palette.mjs';

const ITEMS = join(dirname(fileURLToPath(import.meta.url)), '..', 'items');
const FRAMEWORKS = ['html', 'svelte', 'react', 'vue', 'astro'];
const SANS = { family: 'Inter Tight', weights: [400, 500, 600] };
const MONO = { family: 'Fragment Mono', weights: [400] };

const name = (id) => id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const put = (id, fw, file, text) => {
  mkdirSync(join(ITEMS, id, fw), { recursive: true });
  writeFileSync(join(ITEMS, id, fw, file), text);
};

function manifest(item, C) {
  const file = join(ITEMS, item.id, 'manifest.json');
  const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const fonts = C.includes('--feega-font-mono') ? [SANS, MONO] : [SANS];
  const next = {
    id: item.id,
    name: item.name ?? old.name,
    description: item.description ?? old.description,
    category: item.category ?? old.category,
    tags: item.tags ?? old.tags,
    frameworks: FRAMEWORKS,
    dependencies: [],
    fonts,
    tier: 'free'
  };
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
}

function emit(id, C, f) {
  const N = name(id);
  put(id, 'html', 'index.html', f.html.endsWith('\n') ? f.html : f.html + '\n');
  put(id, 'html', 'style.css', C);
  put(id, 'svelte', `${N}.svelte`, f.svelte);
  put(id, 'vue', `${N}.vue`, f.vue);
  put(id, 'astro', `${N}.astro`, f.astro);
  put(id, 'react', `${N}.tsx`, f.react);
  put(id, 'react', `${N}.css`, C);
}

for (const item of [...sections, ...app, ...components, ...variants, ...blocks, ...pieces]) {
  const C = css(`fl-${item.id}`, item.mods, item.css);
  const N = name(item.id);
  const m = item.markup.trim();
  emit(item.id, C, {
    html: m,
    svelte: `${m}\n\n<style>\n${C}</style>\n`,
    vue: `<template>\n${indent(m, 2)}\n</template>\n\n<style scoped>\n${C}</style>\n`,
    astro: `---\n---\n\n${m}\n\n<style>\n${C}</style>\n`,
    react: `import './${N}.css';\n\nexport function ${N}() {\n  return (\n${indent(jsx(m), 4)}\n  );\n}\n`
  });
  manifest(item, C);
}

for (const item of [...interactive, palette]) {
  const C = css(`fl-${item.id}`, item.mods, item.css);
  emit(item.id, C, item.files(C));
  manifest(item, C);
}

console.log('ok');
