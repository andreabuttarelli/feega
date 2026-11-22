import { describe, expect, it } from 'vitest';
import { AddPlace } from './add-node';
import type { ReadFile } from './files';
import { Layout, TARGETS, layoutOf, libraryInsert, type InsertItem } from './library-insert';

const files = (map: Record<string, string>): ReadFile => async (path) => map[path] ?? null;

const pkg = (deps: string[]) => JSON.stringify({ dependencies: Object.fromEntries(deps.map((d) => [d, '1'])) });

const KIT_ALIAS = '$' + 'lib';

const TOKENS = ':root { --feega-ink: #111; }\n';

const ITEM: InsertItem = {
  id: 'pricing',
  component: 'Pricing',
  fonts: [
    { family: 'Inter Tight', weights: [400, 600] },
    { family: 'Fragment Mono', weights: [400] }
  ],
  files: {
    svelte: [{ name: 'Pricing.svelte', text: '<section class="fl-pricing"></section>\n' }],
    react: [
      { name: 'Pricing.tsx', text: "import './Pricing.css';\n\nexport function Pricing() {\n  return <section className=\"fl-pricing\" />;\n}\n" },
      { name: 'Pricing.css', text: '.fl-pricing { color: red; }\n' }
    ],
    vue: [{ name: 'Pricing.vue', text: '<template>\n  <section class="fl-pricing"></section>\n</template>\n' }],
    astro: [{ name: 'Pricing.astro', text: '---\n---\n\n<section class="fl-pricing"></section>\n' }]
  }
};

const STATEFUL: InsertItem = {
  ...ITEM,
  id: 'faq',
  component: 'Faq',
  files: { ...ITEM.files, react: [{ name: 'Faq.tsx', text: "import { useState } from 'react';\n\nexport function Faq() {\n  const [open] = useState(false);\n  return <div>{String(open)}</div>;\n}\n" }] }
};

const SVELTE_PAGE = '<main>\n  <h1>Title</h1>\n</main>\n';
const TSX_PAGE = 'export default function App() {\n  return (\n    <main>\n      <h1>Title</h1>\n    </main>\n  );\n}\n';
const VUE_PAGE = '<template>\n  <main>\n    <h1>Title</h1>\n  </main>\n</template>\n';
const ASTRO_PAGE = '---\nconst title = "x";\n---\n\n<main>\n  <h1>Title</h1>\n</main>\n';
const H1_SVELTE = { file: 'src/routes/+page.svelte', line: 2, col: 3 };

type Out = Awaited<ReturnType<typeof libraryInsert>>;
const changes = (out: Out) => {
  if (!out.ok) {
    throw new Error(out.reason);
  }
  return Object.fromEntries(out.changes.map((c) => [c.path, c]));
};

const kit = (extra: Record<string, string> = {}) => files({ 'package.json': pkg(['@sveltejs/kit', 'svelte']), 'src/routes/+page.svelte': SVELTE_PAGE, 'src/app.css': 'body { margin: 0; }\n', ...extra });

describe('layoutOf', () => {
  it('names the layout from package.json, most specific first', () => {
    expect(layoutOf(pkg(['@sveltejs/kit', 'svelte']))).toBe(Layout.SvelteKit);
    expect(layoutOf(pkg(['svelte', 'vite']))).toBe(Layout.Svelte);
    expect(layoutOf(pkg(['next', 'react']))).toBe(Layout.Next);
    expect(layoutOf(pkg(['react', 'vite']))).toBe(Layout.React);
    expect(layoutOf(pkg(['nuxt', 'vue']))).toBe(Layout.Nuxt);
    expect(layoutOf(pkg(['vue', 'vite']))).toBe(Layout.Vue);
    expect(layoutOf(pkg(['astro', 'react']))).toBe(Layout.Astro);
    expect(layoutOf(pkg(['express']))).toBeNull();
    expect(layoutOf(null)).toBeNull();
    expect(layoutOf('not json')).toBeNull();
  });
});

describe('TARGETS', () => {
  it('maps every layout to its folder and import rule', () => {
    const rows = Object.fromEntries(Object.values(Layout).map((l) => [l, [TARGETS[l].dir, TARGETS[l].importFrom('src/routes/+page.svelte', `${TARGETS[l].dir}/Pricing`)]]));
    expect(rows).toEqual({
      [Layout.SvelteKit]: ['src/lib/components/feega', '$lib/components/feega/Pricing'],
      [Layout.Svelte]: ['src/lib/components/feega', '../lib/components/feega/Pricing'],
      [Layout.React]: ['src/components/feega', '../components/feega/Pricing'],
      [Layout.Next]: ['src/components/feega', '../components/feega/Pricing'],
      [Layout.Vue]: ['src/components/feega', '../components/feega/Pricing'],
      [Layout.Nuxt]: ['components/feega', null],
      [Layout.Astro]: ['src/components/feega', '../components/feega/Pricing']
    });
  });
});

describe('libraryInsert on SvelteKit', () => {
  it('writes the component, tokens, sheet import, fonts, import and usage', async () => {
    const out = await libraryInsert(kit(), H1_SVELTE, AddPlace.After, ITEM, TOKENS);
    const c = changes(out);
    expect(c['src/lib/components/feega/Pricing.svelte'].after).toBe(ITEM.files.svelte[0].text);
    expect(c['src/lib/components/feega/Pricing.svelte'].before).toBe('');
    expect(c['src/lib/components/feega/tokens.css'].after).toBe(TOKENS);
    expect(c['src/app.css'].after).toContain('@import "./lib/components/feega/tokens.css";');
    expect(c['src/app.css'].after).toContain('family=Inter+Tight:wght@400;600&display=swap');
    expect(c['src/app.css'].after).toContain('family=Fragment+Mono:wght@400&display=swap');
    expect(c['src/app.css'].after).toContain('body { margin: 0; }');
    expect(c['src/routes/+page.svelte'].after).toBe(
      `<script lang="ts">\n  import Pricing from '${KIT_ALIAS}/components/feega/Pricing.svelte';\n</script>\n\n<main>\n  <h1>Title</h1>\n  <Pricing />\n</main>\n`
    );
    expect(Object.keys(c)).toHaveLength(4);
  });

  it('reports the usage as the selection, after the import shifted the lines', async () => {
    const out = await libraryInsert(kit(), H1_SVELTE, AddPlace.After, ITEM, TOKENS);
    expect(out.ok && out.selected).toEqual({ file: 'src/routes/+page.svelte', line: 7, col: 3 });
  });

  it('adds the import to the existing instance script', async () => {
    const page = '<script lang="ts">\n  let n = 1;\n</script>\n\n<main>\n  <h1>Title</h1>\n</main>\n';
    const out = await libraryInsert(kit({ 'src/routes/+page.svelte': page }), { file: 'src/routes/+page.svelte', line: 6, col: 3 }, AddPlace.After, ITEM, TOKENS);
    expect(changes(out)['src/routes/+page.svelte'].after).toContain(`<script lang="ts">\n  import Pricing from '${KIT_ALIAS}/components/feega/Pricing.svelte';\n  let n = 1;\n</script>`);
  });

  it('skips the module script when adding the import', async () => {
    const page = '<script module>\n  export const x = 1;\n</script>\n\n<main>\n  <h1>Title</h1>\n</main>\n';
    const out = await libraryInsert(kit({ 'src/routes/+page.svelte': page }), { file: 'src/routes/+page.svelte', line: 6, col: 3 }, AddPlace.After, ITEM, TOKENS);
    const after = changes(out)['src/routes/+page.svelte'].after;
    expect(after.startsWith('<script lang="ts">\n  import Pricing')).toBe(true);
    expect(after).toContain('<script module>');
  });

  it('wires tokens and fonts once', async () => {
    const first = await libraryInsert(kit(), H1_SVELTE, AddPlace.After, ITEM, TOKENS);
    const done = changes(first);
    const second = kit({
      'src/app.css': done['src/app.css'].after,
      'src/lib/components/feega/tokens.css': TOKENS,
      'src/lib/components/feega/Pricing.svelte': ITEM.files.svelte[0].text,
      'src/routes/+page.svelte': done['src/routes/+page.svelte'].after
    });
    const again = changes(await libraryInsert(second, { file: 'src/routes/+page.svelte', line: 7, col: 3 }, AddPlace.After, ITEM, TOKENS));
    expect(Object.keys(again)).toEqual(['src/routes/+page.svelte']);
    expect(again['src/routes/+page.svelte'].after.match(/import Pricing from/g)).toHaveLength(1);
    expect(again['src/routes/+page.svelte'].after.match(/<Pricing \/>/g)).toHaveLength(2);
  });

  it('suffixes the name when a different file already holds it', async () => {
    const out = await libraryInsert(kit({ 'src/lib/components/feega/Pricing.svelte': '<p>mine</p>\n' }), H1_SVELTE, AddPlace.After, ITEM, TOKENS);
    const c = changes(out);
    expect(c['src/lib/components/feega/Pricing2.svelte'].after).toBe(ITEM.files.svelte[0].text);
    expect(c['src/lib/components/feega/Pricing.svelte']).toBeUndefined();
    expect(c['src/routes/+page.svelte'].after).toContain(`import Pricing2 from '${KIT_ALIAS}/components/feega/Pricing2.svelte';`);
    expect(c['src/routes/+page.svelte'].after).toContain('<Pricing2 />');
  });

  it('keeps counting past a taken suffix', async () => {
    const taken = { 'src/lib/components/feega/Pricing.svelte': 'a', 'src/lib/components/feega/Pricing2.svelte': 'b' };
    const c = changes(await libraryInsert(kit(taken), H1_SVELTE, AddPlace.After, ITEM, TOKENS));
    expect(c['src/lib/components/feega/Pricing3.svelte']).toBeDefined();
  });

  it('has the component import the tokens itself when the project has no global stylesheet', async () => {
    const read = files({ 'package.json': pkg(['@sveltejs/kit']), 'src/routes/+page.svelte': SVELTE_PAGE });
    const c = changes(await libraryInsert(read, H1_SVELTE, AddPlace.After, ITEM, TOKENS));
    expect(c['src/lib/components/feega/tokens.css'].after).toBe(TOKENS);
    expect(c['src/lib/components/feega/Pricing.svelte'].after).toBe(`<script lang="ts">\n  import './tokens.css';\n</script>\n\n${ITEM.files.svelte[0].text}`);
  });
});

describe('libraryInsert on React', () => {
  const react = (extra: Record<string, string> = {}) => files({ 'package.json': pkg(['react', 'vite']), 'src/App.tsx': TSX_PAGE, 'src/index.css': 'body { margin: 0; }\n', ...extra });
  const H1 = { file: 'src/App.tsx', line: 4, col: 7 };

  it('copies the component and its stylesheet and imports by name', async () => {
    const c = changes(await libraryInsert(react(), H1, AddPlace.After, ITEM, TOKENS));
    expect(c['src/components/feega/Pricing.tsx'].after).toBe(ITEM.files.react[0].text);
    expect(c['src/components/feega/Pricing.css'].after).toBe(ITEM.files.react[1].text);
    expect(c['src/components/feega/tokens.css'].after).toBe(TOKENS);
    expect(c['src/index.css'].after).toContain('@import "./components/feega/tokens.css";');
    expect(c['src/App.tsx'].after).toBe(
      "import { Pricing } from './components/feega/Pricing';\n\nexport default function App() {\n  return (\n    <main>\n      <h1>Title</h1>\n      <Pricing />\n    </main>\n  );\n}\n"
    );
  });

  it('renames the function and the stylesheet import on a collision', async () => {
    const c = changes(await libraryInsert(react({ 'src/components/feega/Pricing.tsx': 'mine' }), H1, AddPlace.After, ITEM, TOKENS));
    expect(c['src/components/feega/Pricing2.tsx'].after).toContain("import './Pricing2.css';");
    expect(c['src/components/feega/Pricing2.tsx'].after).toContain('export function Pricing2()');
    expect(c['src/components/feega/Pricing2.css']).toBeDefined();
    expect(c['src/App.tsx'].after).toContain("import { Pricing2 } from './components/feega/Pricing2';");
  });

  it('imports the tokens in the component without a global stylesheet', async () => {
    const read = files({ 'package.json': pkg(['react', 'vite']), 'src/App.tsx': TSX_PAGE });
    const c = changes(await libraryInsert(read, H1, AddPlace.After, ITEM, TOKENS));
    expect(c['src/components/feega/Pricing.tsx'].after.startsWith("import './Pricing.css';\nimport './tokens.css';\n")).toBe(true);
  });

  it('adds the import after the existing ones', async () => {
    const page = "import { useState } from 'react';\nimport './app.css';\n\nexport default function App() {\n  return (\n    <main>\n      <h1>Title</h1>\n    </main>\n  );\n}\n";
    const c = changes(await libraryInsert(react({ 'src/App.tsx': page }), { file: 'src/App.tsx', line: 7, col: 7 }, AddPlace.After, ITEM, TOKENS));
    expect(c['src/App.tsx'].after.startsWith("import { useState } from 'react';\nimport './app.css';\nimport { Pricing } from './components/feega/Pricing';\n")).toBe(true);
  });

  it('marks stateful items as client components on Next', async () => {
    const next = files({ 'package.json': pkg(['next', 'react']), 'src/app/page.tsx': TSX_PAGE, 'src/app/globals.css': '' });
    const c = changes(await libraryInsert(next, { file: 'src/app/page.tsx', line: 4, col: 7 }, AddPlace.After, STATEFUL, TOKENS));
    expect(c['src/components/feega/Faq.tsx'].after.startsWith("'use client';\n\nimport { useState }")).toBe(true);
  });

  it('leaves stateless items on Next as server components', async () => {
    const next = files({ 'package.json': pkg(['next', 'react']), 'src/app/page.tsx': TSX_PAGE, 'src/app/globals.css': '' });
    const c = changes(await libraryInsert(next, { file: 'src/app/page.tsx', line: 4, col: 7 }, AddPlace.After, ITEM, TOKENS));
    expect(c['src/components/feega/Pricing.tsx'].after).not.toContain('use client');
  });

  it('leaves stateful items alone on plain React', async () => {
    const c = changes(await libraryInsert(react(), H1, AddPlace.After, STATEFUL, TOKENS));
    expect(c['src/components/feega/Faq.tsx'].after).not.toContain('use client');
  });
});

describe('libraryInsert on Vue, Nuxt and Astro', () => {
  it('imports in script setup on Vue', async () => {
    const read = files({ 'package.json': pkg(['vue', 'vite']), 'src/App.vue': VUE_PAGE, 'src/style.css': '' });
    const c = changes(await libraryInsert(read, { file: 'src/App.vue', line: 3, col: 5 }, AddPlace.After, ITEM, TOKENS));
    expect(c['src/App.vue'].after).toBe(
      `<script setup lang="ts">\n  import Pricing from './components/feega/Pricing.vue';\n</script>\n\n<template>\n  <main>\n    <h1>Title</h1>\n    <Pricing />\n  </main>\n</template>\n`
    );
  });

  it('needs no import on Nuxt, which auto-imports by folder', async () => {
    const read = files({ 'package.json': pkg(['nuxt', 'vue']), 'pages/index.vue': VUE_PAGE, 'assets/css/main.css': '' });
    const c = changes(await libraryInsert(read, { file: 'pages/index.vue', line: 3, col: 5 }, AddPlace.After, ITEM, TOKENS));
    expect(c['components/feega/Pricing.vue']).toBeDefined();
    expect(c['pages/index.vue'].after).toContain('<FeegaPricing />');
    expect(c['pages/index.vue'].after).not.toContain('import');
  });

  it('imports in the frontmatter on Astro', async () => {
    const read = files({ 'package.json': pkg(['astro']), 'src/pages/index.astro': ASTRO_PAGE, 'src/styles/global.css': '' });
    const c = changes(await libraryInsert(read, { file: 'src/pages/index.astro', line: 6, col: 3 }, AddPlace.After, ITEM, TOKENS));
    expect(c['src/pages/index.astro'].after.startsWith("---\nimport Pricing from '../components/feega/Pricing.astro';\nconst title = \"x\";\n---")).toBe(true);
    expect(c['src/pages/index.astro'].after).toContain('<Pricing />');
  });

  it('creates the frontmatter when the page has none', async () => {
    const read = files({ 'package.json': pkg(['astro']), 'src/pages/index.astro': '<main>\n  <h1>Title</h1>\n</main>\n', 'src/styles/global.css': '' });
    const c = changes(await libraryInsert(read, { file: 'src/pages/index.astro', line: 2, col: 3 }, AddPlace.After, ITEM, TOKENS));
    expect(c['src/pages/index.astro'].after.startsWith("---\nimport Pricing from '../components/feega/Pricing.astro';\n---\n\n<main>")).toBe(true);
  });
});

describe('libraryInsert refusals', () => {
  it('refuses a project without a supported framework', async () => {
    const out = await libraryInsert(files({ 'package.json': pkg(['express']), 'a.svelte': '<p></p>' }), { file: 'a.svelte', line: 1, col: 1 }, AddPlace.After, ITEM, TOKENS);
    expect(out).toMatchObject({ ok: false, reason: expect.stringContaining('Svelte, React, Vue or Astro') });
  });

  it('refuses a target file the framework cannot render a component in', async () => {
    const read = kit({ 'index.html': '<main></main>' });
    const out = await libraryInsert(read, { file: 'index.html', line: 1, col: 1 }, AddPlace.After, ITEM, TOKENS);
    expect(out).toMatchObject({ ok: false, reason: expect.stringContaining('.svelte') });
  });

  it('refuses a missing target element', async () => {
    const out = await libraryInsert(kit(), { file: 'src/routes/+page.svelte', line: 40, col: 1 }, AddPlace.After, ITEM, TOKENS);
    expect(out.ok).toBe(false);
  });
});
