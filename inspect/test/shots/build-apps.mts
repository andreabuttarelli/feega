import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY } from './copy.ts';
import { PAGES, Stack, type Page, type Palette } from './pages.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBRARY = resolve(process.env.LIBRARY ?? join(HERE, '../../../packages/library'));
const APPS = join(HERE, 'apps');
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Fragment+Mono&display=swap';

const pascal = (id: string) => id.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');

const paletteCss = (p: Palette) => `html[data-theme]{
  color-scheme:${p.scheme};
  --feega-bg:${p.bg};--feega-surface:${p.surface};--feega-raised:${p.raised};--feega-input:${p.raised};
  --feega-fg:${p.fg};--feega-fg-muted:${p.muted};--feega-fg-subtle:${p.subtle};
  --feega-line:${p.line};--feega-line-strong:${p.lineStrong};--feega-dot:${p.lineStrong};
  --feega-accent:${p.accent};--feega-accent-hover:${p.accentHover};--feega-accent-fg:${p.accentFg};
  --feega-accent-soft:${p.accentSoft};--feega-accent-text:${p.accentText};--feega-focus:${p.accent};
}
`;

const applyCopy = (page: Page, text: string) => Object.entries(COPY[page.id] ?? {}).reduce((out, [from, to]) => out.replaceAll(from, to), text);

const item = (id: string, path: string) => readFile(join(LIBRARY, 'items', id, path), 'utf8');

const write = async (root: string, path: string, content: string) => {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
};

const PACKAGE = (page: Page, dev: string, deps: Record<string, string>, devDeps: Record<string, string>) =>
  JSON.stringify({ name: `shots-${page.id}`, private: true, type: 'module', scripts: { dev }, dependencies: deps, devDependencies: devDeps }, null, 2) + '\n';

const VITE = '^6.3.0';

async function html(page: Page, root: string) {
  const markup = (await Promise.all(page.items.map((id) => item(id, 'html/index.html')))).join('\n');
  const css = (await Promise.all(page.items.map((id) => item(id, 'html/style.css')))).join('\n');
  await write(root, 'index.html', applyCopy(page, `<!doctype html>
<html lang="en" data-theme="${page.palette.scheme}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${page.title}</title>
<link rel="stylesheet" href="${FONTS}"><link rel="stylesheet" href="/style.css"></head>
<body style="margin:0;background:var(--feega-bg)">
${markup}
</body>
</html>
`));
  await write(root, 'style.css', `${await readFile(join(LIBRARY, 'tokens.css'), 'utf8')}\n${paletteCss(page.palette)}\n${css}`);
  await write(root, 'package.json', PACKAGE(page, 'vite', {}, { vite: VITE }));
  await write(root, 'vite.config.js', "import { defineConfig } from 'vite';\n\nexport default defineConfig({});\n");
}

async function copyComponents(page: Page, root: string, folder: string, extensions: Record<string, string[]>) {
  for (const id of page.items) {
    for (const [dir, files] of Object.entries(extensions)) {
      for (const ext of files) {
        const name = `${pascal(id)}${ext}`;
        await write(root, `${folder}/${name}`, applyCopy(page, await item(id, `${dir}/${name}`)));
      }
    }
  }
}

async function shared(page: Page, root: string, folder: string) {
  await write(root, `${folder}/tokens.css`, await readFile(join(LIBRARY, 'tokens.css'), 'utf8'));
  await write(root, `${folder}/palette.css`, paletteCss(page.palette));
}

async function react(page: Page, root: string) {
  await copyComponents(page, root, 'src/components', { react: ['.tsx', '.css'] });
  await shared(page, root, 'src');
  const names = page.items.map(pascal);
  await write(root, 'src/App.jsx', `${names.map((n) => `import { ${n} } from './components/${n}.tsx';`).join('\n')}

export function App() {
  return (
    <>
${names.map((n) => `      <${n} />`).join('\n')}
    </>
  );
}
`);
  await write(root, 'src/main.jsx', "import { createRoot } from 'react-dom/client';\nimport './tokens.css';\nimport './palette.css';\nimport { App } from './App.jsx';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n");
  await write(root, 'index.html', `<!doctype html>
<html lang="en" data-theme="${page.palette.scheme}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${page.title}</title><link rel="stylesheet" href="${FONTS}"></head>
<body style="margin:0;background:var(--feega-bg)"><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
`);
  await write(root, 'package.json', PACKAGE(page, 'vite', { react: '^19.1.0', 'react-dom': '^19.1.0' }, { '@vitejs/plugin-react': '^5.0.0', vite: VITE }));
  await write(root, 'vite.config.js', "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n");
}

async function vue(page: Page, root: string) {
  await copyComponents(page, root, 'src/components', { vue: ['.vue'] });
  await shared(page, root, 'src');
  const names = page.items.map(pascal);
  await write(root, 'src/App.vue', `<script setup>
${names.map((n) => `import ${n} from './components/${n}.vue';`).join('\n')}
</script>

<template>
${names.map((n) => `  <${n} />`).join('\n')}
</template>
`);
  await write(root, 'src/main.js', "import { createApp } from 'vue';\nimport './tokens.css';\nimport './palette.css';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');\n");
  await write(root, 'index.html', `<!doctype html>
<html lang="en" data-theme="${page.palette.scheme}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${page.title}</title><link rel="stylesheet" href="${FONTS}"></head>
<body style="margin:0;background:var(--feega-bg)"><div id="app"></div><script type="module" src="/src/main.js"></script></body>
</html>
`);
  await write(root, 'package.json', PACKAGE(page, 'vite', { vue: '^3.5.0' }, { '@vitejs/plugin-vue': '^6.0.0', vite: VITE }));
  await write(root, 'vite.config.js', "import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\n\nexport default defineConfig({ plugins: [vue()] });\n");
}

async function sveltekit(page: Page, root: string) {
  await copyComponents(page, root, 'src/lib/components', { svelte: ['.svelte'] });
  await shared(page, root, 'src/lib');
  const names = page.items.map(pascal);
  await write(root, 'src/routes/+page.svelte', `<script>
${names.map((n) => `  import ${n} from '$lib/components/${n}.svelte';`).join('\n')}
</script>

${names.map((n) => `<${n} />`).join('\n')}
`);
  await write(root, 'src/routes/+layout.svelte', "<script>\n  import '$lib/tokens.css';\n  import '$lib/palette.css';\n\n  let { children } = $props();\n</script>\n\n{@render children()}\n");
  await write(root, 'src/app.html', `<!doctype html>
<html lang="en" data-theme="${page.palette.scheme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${page.title}</title>
    <link rel="stylesheet" href="${FONTS}" />
    %sveltekit.head%
  </head>
  <body style="margin: 0">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
`);
  await write(root, 'package.json', PACKAGE(page, 'vite dev', {}, { '@sveltejs/adapter-auto': '^6.0.0', '@sveltejs/kit': '^2.31.0', '@sveltejs/vite-plugin-svelte': '^5.0.0', svelte: '^5.38.0', vite: VITE }));
  await write(root, 'svelte.config.js', "import adapter from '@sveltejs/adapter-auto';\n\nexport default { kit: { adapter: adapter() } };\n");
  await write(root, 'vite.config.js', "import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({ plugins: [sveltekit()] });\n");
}

async function nuxt(page: Page, root: string) {
  await copyComponents(page, root, 'app/components', { vue: ['.vue'] });
  await shared(page, root, 'app/assets');
  await write(root, 'app/app.vue', `<template>\n  <div>\n${page.items.map((id) => `    <${pascal(id)} />`).join('\n')}\n  </div>\n</template>\n`);
  await write(root, 'nuxt.config.ts', `export default defineNuxtConfig({
  devtools: { enabled: false },
  telemetry: false,
  css: ['~/assets/tokens.css', '~/assets/palette.css'],
  app: { head: { title: '${page.title}', htmlAttrs: { lang: 'en', 'data-theme': '${page.palette.scheme}' }, bodyAttrs: { style: 'margin:0' }, link: [{ rel: 'stylesheet', href: '${FONTS}' }] } }
});
`);
  await write(root, 'package.json', PACKAGE(page, 'nuxt dev', { nuxt: '^4.0.0', vue: '^3.5.0', 'vue-router': '^4.5.0' }, {}));
}

const BUILDERS: Record<Stack, (page: Page, root: string) => Promise<void>> = {
  [Stack.Html]: html,
  [Stack.React]: react,
  [Stack.Vue]: vue,
  [Stack.SvelteKit]: sveltekit,
  [Stack.Nuxt]: nuxt
};

await mkdir(APPS, { recursive: true });
for (const page of PAGES) {
  const root = join(APPS, page.id);
  await rm(root, { recursive: true, force: true });
  await BUILDERS[page.stack](page, root);
}
console.log(`built ${PAGES.length} apps from ${LIBRARY}`);
