import type { Files } from '../init';

export enum Stack {
  ReactVite = 'react-vite',
  Next = 'next',
  SvelteKit = 'sveltekit',
  VueVite = 'vue-vite',
  Astro = 'astro',
  Nuxt = 'nuxt'
}

export type ProjectName = { slug: string; title: string };

export type StackRow = {
  label: string;
  page: string;
  plugin: boolean;
  files: (name: ProjectName) => Files;
};

const json = (value: object) => `${JSON.stringify(value, null, 2)}\n`;

const IGNORED = 'node_modules\ndist\n.next\n.svelte-kit\n.nuxt\n.output\n.astro\n';

const BODY = `html, body { margin: 0; }\nbody { font-family: system-ui, sans-serif; }\n`;

const pkg = (name: ProjectName, scripts: Record<string, string>, dependencies: Record<string, string>, devDependencies: Record<string, string> = {}, extra: object = {}) =>
  json({ name: name.slug, private: true, version: '0.0.0', ...extra, scripts, dependencies, devDependencies });

const REACT_PAGE = (title: string) => `export default function App() {\n  return (\n    <main>\n      <h1>${title}</h1>\n    </main>\n  );\n}\n`;

const reactVite = ({ slug, title }: ProjectName): Files => ({
  'package.json': pkg({ slug, title }, { dev: 'vite', build: 'vite build' }, { react: '^19.2.0', 'react-dom': '^19.2.0' }, { vite: '^7.2.4', '@vitejs/plugin-react': '^5.1.1', typescript: '~5.9.3', '@types/react': '^19.2.0', '@types/react-dom': '^19.2.0' }, { type: 'module' }),
  'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
  'vite.config.ts': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()]\n});\n`,
  'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, noEmit: true }, include: ['src'] }),
  'src/main.tsx': `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n`,
  'src/App.tsx': REACT_PAGE(title),
  'src/index.css': BODY,
  '.gitignore': IGNORED
});

const next = ({ slug, title }: ProjectName): Files => ({
  'package.json': pkg({ slug, title }, { dev: 'next dev', build: 'next build', start: 'next start' }, { next: '^15.5.29', react: '^19.2.0', 'react-dom': '^19.2.0' }, { typescript: '~5.9.3', '@types/node': '^22.0.0', '@types/react': '^19.2.0', '@types/react-dom': '^19.2.0' }),
  'next.config.mjs': `const nextConfig = {};\n\nexport default nextConfig;\n`,
  'tsconfig.json': json({ compilerOptions: { target: 'ES2022', lib: ['dom', 'dom.iterable', 'esnext'], jsx: 'preserve', module: 'esnext', moduleResolution: 'bundler', strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true, resolveJsonModule: true, isolatedModules: true, incremental: true, allowJs: true, plugins: [{ name: 'next' }] }, include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }),
  'app/layout.tsx': `import type { ReactNode } from 'react';\nimport './globals.css';\n\nexport const metadata = { title: '${title}' };\n\nexport default function RootLayout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`,
  'app/page.tsx': REACT_PAGE(title).replace('function App', 'function Page'),
  'app/globals.css': BODY,
  '.gitignore': IGNORED
});

const svelteKit = ({ slug, title }: ProjectName): Files => ({
  'package.json': pkg({ slug, title }, { dev: 'vite dev', build: 'vite build' }, {}, { '@sveltejs/adapter-auto': '^6.0.0', '@sveltejs/kit': '^2.20.0', '@sveltejs/vite-plugin-svelte': '^6.0.0', svelte: '^5.0.0', typescript: '~5.9.3', vite: '^7.2.4' }, { type: 'module' }),
  'svelte.config.js': `import adapter from '@sveltejs/adapter-auto';\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n\nexport default {\n  preprocess: vitePreprocess(),\n  kit: { adapter: adapter() }\n};\n`,
  'vite.config.ts': `import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({\n  plugins: [sveltekit()]\n});\n`,
  'tsconfig.json': json({ extends: './.svelte-kit/tsconfig.json', compilerOptions: { strict: true, skipLibCheck: true } }),
  'src/app.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    %sveltekit.head%\n  </head>\n  <body>\n    <div style="display: contents">%sveltekit.body%</div>\n  </body>\n</html>\n`,
  'src/app.css': BODY,
  'src/routes/+layout.svelte': `<script lang="ts">\n  import '../app.css';\n\n  let { children } = $props();\n</script>\n\n{@render children()}\n`,
  'src/routes/+page.svelte': `<main>\n  <h1>${title}</h1>\n</main>\n`,
  '.gitignore': IGNORED
});

const vueVite = ({ slug, title }: ProjectName): Files => ({
  'package.json': pkg({ slug, title }, { dev: 'vite', build: 'vite build' }, { vue: '^3.5.0' }, { vite: '^7.2.4', '@vitejs/plugin-vue': '^6.0.0', typescript: '~5.9.3' }, { type: 'module' }),
  'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n`,
  'vite.config.ts': `import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\n\nexport default defineConfig({\n  plugins: [vue()]\n});\n`,
  'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: true, skipLibCheck: true, noEmit: true }, include: ['src'] }),
  'src/main.ts': `import { createApp } from 'vue';\nimport App from './App.vue';\nimport './style.css';\n\ncreateApp(App).mount('#app');\n`,
  'src/App.vue': `<template>\n  <main>\n    <h1>${title}</h1>\n  </main>\n</template>\n`,
  'src/style.css': BODY,
  '.gitignore': IGNORED
});

const astro = ({ slug, title }: ProjectName): Files => ({
  'package.json': pkg({ slug, title }, { dev: 'astro dev', build: 'astro build' }, { astro: '^5.0.0' }, {}, { type: 'module' }),
  'astro.config.mjs': `import { defineConfig } from 'astro/config';\n\nexport default defineConfig({});\n`,
  'tsconfig.json': json({ extends: 'astro/tsconfigs/strict', include: ['.astro/types.d.ts', '**/*'], exclude: ['dist'] }),
  'src/styles/global.css': BODY,
  'src/pages/index.astro': `---\nimport '../styles/global.css';\n---\n\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <main>\n      <h1>${title}</h1>\n    </main>\n  </body>\n</html>\n`,
  '.gitignore': IGNORED
});

const nuxt = ({ slug, title }: ProjectName): Files => ({
  'package.json': pkg({ slug, title }, { dev: 'nuxt dev', build: 'nuxt build' }, { nuxt: '^4.0.0', vue: '^3.5.0' }, { typescript: '~5.9.3' }, { type: 'module' }),
  'nuxt.config.ts': `export default defineNuxtConfig({\n  srcDir: '.',\n  compatibilityDate: '2025-07-15',\n  devtools: { enabled: false },\n  css: ['~/src/assets/main.css']\n});\n`,
  'tsconfig.json': json({ extends: './.nuxt/tsconfig.json' }),
  'src/assets/main.css': BODY,
  'app.vue': `<template>\n  <NuxtPage />\n</template>\n`,
  'pages/index.vue': `<template>\n  <main>\n    <h1>${title}</h1>\n  </main>\n</template>\n`,
  '.gitignore': IGNORED
});

export const STACKS: Record<Stack, StackRow> = {
  [Stack.ReactVite]: { label: 'React (Vite)', page: 'src/App.tsx', plugin: true, files: reactVite },
  [Stack.Next]: { label: 'Next.js', page: 'app/page.tsx', plugin: true, files: next },
  [Stack.SvelteKit]: { label: 'SvelteKit', page: 'src/routes/+page.svelte', plugin: true, files: svelteKit },
  [Stack.VueVite]: { label: 'Vue (Vite)', page: 'src/App.vue', plugin: true, files: vueVite },
  [Stack.Astro]: { label: 'Astro', page: 'src/pages/index.astro', plugin: false, files: astro },
  [Stack.Nuxt]: { label: 'Nuxt', page: 'pages/index.vue', plugin: false, files: nuxt }
};
