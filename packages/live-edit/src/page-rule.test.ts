import { describe, expect, it } from 'vitest';
import { PageTarget, pageRule } from './page-rule';

const files = (all: Record<string, string>) => async (path: string) => all[path] ?? null;

describe('page-wide styles', () => {
  it('body styles land in the global stylesheet, merged into an existing body rule', async () => {
    const css = '@import "tailwindcss";\n\nbody {\n  margin: 0;\n}\n';
    const out = await pageRule(files({ 'src/app.css': css }), PageTarget.Body, { 'background-color': '#111111', margin: '8px' });

    expect(out).toEqual({ ok: true, changes: [{ path: 'src/app.css', before: css, after: '@import "tailwindcss";\n\nbody {\n  margin: 8px;\n  background-color: #111111;\n}\n' }] });
  });

  it('html gets its own rule appended when there is none', async () => {
    const out = await pageRule(files({ 'app/globals.css': '.x {\n  color: red;\n}\n' }), PageTarget.Html, { 'font-size': '18px' });

    expect(out.ok && out.changes[0].after).toBe('.x {\n  color: red;\n}\n\nhtml {\n  font-size: 18px;\n}\n');
  });

  it('a body rule is not confused with a selector that only contains the word', async () => {
    const css = '.body {\n  color: red;\n}\n';
    const out = await pageRule(files({ 'src/app.css': css }), PageTarget.Body, { color: 'blue' });

    expect(out.ok && out.changes[0].after).toBe('.body {\n  color: red;\n}\n\nbody {\n  color: blue;\n}\n');
  });

  it('without a global stylesheet it says so', async () => {
    const out = await pageRule(files({}), PageTarget.Body, { color: 'red' });

    expect(out.ok).toBe(false);
  });

  describe('without a global stylesheet', () => {
    const body = { 'background-color': '#111111' };
    const after = async (all: Record<string, string>) => {
      const out = await pageRule(files(all), PageTarget.Body, body);
      return out.ok ? out.changes : out;
    };

    it('astro: a global style block is added to the layout that holds the html', async () => {
      const page = '---\nconst a = 1;\n---\n\n<html>\n  <body></body>\n</html>\n\n<style>\n  h1 { color: red; }\n</style>\n';
      const out = await after({ 'src/pages/index.astro': page });

      expect(out).toEqual([{ path: 'src/pages/index.astro', before: page, after: `${page.trimEnd()}\n\n<style is:global>\nbody {\n  background-color: #111111;\n}\n</style>\n` }]);
    });

    it('astro: an existing global block gets the rule merged', async () => {
      const layout = '<html><body></body></html>\n<style is:global>\n  body {\n    margin: 0;\n  }\n</style>\n';
      const out = await after({ 'src/layouts/Layout.astro': layout });

      expect(out).toEqual([{ path: 'src/layouts/Layout.astro', before: layout, after: '<html><body></body></html>\n<style is:global>\n  body {\n    margin: 0;\n    background-color: #111111;\n  }\n</style>\n' }]);
    });

    it('astro: a page without the html element is not the layout', async () => {
      expect(await after({ 'src/pages/index.astro': '<h1>x</h1>\n' })).toMatchObject({ ok: false });
    });

    it('vue: an unscoped style block in App.vue, never the scoped one', async () => {
      const app = '<template><div /></template>\n<style scoped>\n.a { color: red; }\n</style>\n';
      const out = await after({ 'src/App.vue': app });

      expect(out).toEqual([{ path: 'src/App.vue', before: app, after: `${app}\n<style>\nbody {\n  background-color: #111111;\n}\n</style>\n` }]);
    });

    it('sveltekit: src/app.css is created and imported in the root layout, together', async () => {
      const layout = '<slot />\n';
      const out = await after({ 'src/routes/+layout.svelte': layout });

      expect(out).toEqual([
        { path: 'src/app.css', before: '', after: 'body {\n  background-color: #111111;\n}\n' },
        { path: 'src/routes/+layout.svelte', before: layout, after: "<script>\n  import '../app.css';\n</script>\n\n<slot />\n" }
      ]);
    });

    it('next: app/globals.css is created and imported in the root layout', async () => {
      const layout = "import type { ReactNode } from 'react';\n\nexport default function L() {}\n";
      const out = await after({ 'app/layout.tsx': layout });

      expect(out).toEqual([
        { path: 'app/globals.css', before: '', after: 'body {\n  background-color: #111111;\n}\n' },
        { path: 'app/layout.tsx', before: layout, after: "import type { ReactNode } from 'react';\nimport './globals.css';\n\nexport default function L() {}\n" }
      ]);
    });

    it('react vite: src/index.css is created and imported in the main entry', async () => {
      const main = "import { createRoot } from 'react-dom/client';\n";
      const out = await after({ 'src/main.tsx': main });

      expect(out).toEqual([
        { path: 'src/index.css', before: '', after: 'body {\n  background-color: #111111;\n}\n' },
        { path: 'src/main.tsx', before: main, after: `${main}import './index.css';\n` }
      ]);
    });

    it('nothing recognised: it says so', async () => {
      expect(await after({})).toMatchObject({ ok: false });
    });
  });
});
