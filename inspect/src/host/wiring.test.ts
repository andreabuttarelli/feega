import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routesIn, wiringOf } from './wiring';

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'feega-wiring-'));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

describe('routesIn', () => {
  it('reads SvelteKit routes and ignores installed packages', async () => {
    const root = project({ 'src/routes/+page.svelte': '', 'src/routes/pricing/+page.svelte': '', 'node_modules/x/src/routes/hidden/+page.svelte': '' });

    expect(await routesIn(root)).toEqual(['/', '/pricing']);
  });

  it('reads Next app routes', async () => {
    const root = project({ 'app/page.jsx': '', 'app/about/page.jsx': '', '.next/server/app/ghost/page.js': '' });

    expect(await routesIn(root)).toEqual(['/', '/about']);
  });

  it('adds the static paths of a Vue router file', async () => {
    const root = project({ 'src/router/index.ts': `export default [{ path: '/', c: 1 }, { path: '/team', c: 2 }, { path: '/u/:id', c: 3 }];` });

    expect(await routesIn(root)).toEqual(['/', '/team']);
  });

  it('has nothing to suggest for a plain React app', async () => {
    expect(await routesIn(project({ 'src/App.jsx': '' }))).toEqual([]);
  });
});

describe('wiringOf', () => {
  it('reports the link, the handlers and the routes of the picked element', async () => {
    const root = project({ 'src/routes/+page.svelte': `<a href="/pricing" onclick={go}>Plans</a>\n<script>function go() {}</script>`, 'src/routes/pricing/+page.svelte': '' });

    const out = await wiringOf(root, 'src/routes/+page.svelte:1:1');

    expect(out.link).toMatchObject({ attr: 'href', value: '/pricing', editable: true });
    expect(out.events).toMatchObject([{ attribute: 'onclick', event: 'click', handler: 'go' }]);
    expect(out.routes).toEqual(['/', '/pricing']);
  });

  it('reports the offsets the source authors for the picked element', async () => {
    const root = project({ 'src/A.svelte': `<span class="badge">New</span>\n<style>\n  .badge { top: 12px; left: 24px; }\n</style>` });

    expect((await wiringOf(root, 'src/A.svelte:1:1')).offsets).toEqual(['top', 'left']);
  });

  it('has no link for a button', async () => {
    const root = project({ 'src/A.jsx': `<button>Go</button>` });

    expect((await wiringOf(root, 'src/A.jsx:1:1')).link).toBeNull();
  });

  it('answers empty for a place outside the workspace', async () => {
    const root = project({ 'src/A.jsx': `<button>Go</button>` });

    expect(await wiringOf(root, '../x.jsx:1:1')).toEqual({ link: null, events: [], routes: [], offsets: [] });
  });
});
