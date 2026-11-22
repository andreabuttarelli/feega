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
import { scrollReveal } from './scroll-reveal.mjs';
import { imageTunnel } from './image-tunnel.mjs';
import { glassButton } from './glass-button.mjs';
import { topoShader } from './topo-shader.mjs';

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIER_DIRS = { free: join(PACKAGE, 'items'), pro: join(PACKAGE, 'pro') };
const FRAMEWORKS = ['html', 'svelte', 'react', 'vue', 'astro'];
const SANS = { family: 'Inter Tight', weights: [400, 500, 600] };
const MONO = { family: 'Fragment Mono', weights: [400] };

const name = (id) => id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const tierOf = (item) => item.tier ?? 'free';
const dirOf = (item) => join(TIER_DIRS[tierOf(item)], item.id);
const put = (item, fw, file, text) => {
  mkdirSync(join(dirOf(item), fw), { recursive: true });
  writeFileSync(join(dirOf(item), fw, file), text);
};

function manifest(item, C) {
  const file = join(dirOf(item), 'manifest.json');
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
    tier: tierOf(item),
    ...(item.preview ? { preview: item.preview } : {})
  };
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
}

function emit(item, C, f) {
  const N = name(item.id);
  put(item, 'html', 'index.html', f.html.endsWith('\n') ? f.html : f.html + '\n');
  put(item, 'html', 'style.css', C);
  put(item, 'svelte', `${N}.svelte`, f.svelte);
  put(item, 'vue', `${N}.vue`, f.vue);
  put(item, 'astro', `${N}.astro`, f.astro);
  put(item, 'react', `${N}.tsx`, f.react);
  put(item, 'react', `${N}.css`, C);
}

for (const item of [...sections, ...app, ...components, ...variants, ...blocks, ...pieces]) {
  const C = css(`fl-${item.id}`, item.mods, item.css);
  const N = name(item.id);
  const m = item.markup.trim();
  emit(item, C, {
    html: m,
    svelte: `${m}\n\n<style>\n${C}</style>\n`,
    vue: `<template>\n${indent(m, 2)}\n</template>\n\n<style scoped>\n${C}</style>\n`,
    astro: `---\n---\n\n${m}\n\n<style>\n${C}</style>\n`,
    react: `import './${N}.css';\n\nexport function ${N}() {\n  return (\n${indent(jsx(m), 4)}\n  );\n}\n`
  });
  manifest(item, C);
}

for (const item of [...interactive, palette, scrollReveal, imageTunnel, glassButton, topoShader]) {
  const C = css(`fl-${item.id}`, item.mods, item.css);
  emit(item, C, item.files(C));
  manifest(item, C);
}

console.log('ok');
