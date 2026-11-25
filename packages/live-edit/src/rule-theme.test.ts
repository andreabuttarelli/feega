import { describe, expect, it } from 'vitest';
import { cssModuleRule } from './css-module';
import { PageTarget, pageRule } from './page-rule';
import { scopedRule } from './scoped-rule';

const SVELTE = '<p class="lead">x</p>\n\n<style>\n  .lead {\n    padding: 8px;\n  }\n</style>\n';
const VUE = SVELTE;
const at = (file: string) => ({ file, line: 1, col: 1 });
const DARK = '.dark';
const FOREST = '[data-theme="forest"]';
const SCHEME = '(prefers-color-scheme: dark)';

const write = async (file: string, source: string, css: Record<string, string>, media: string | null | undefined, within: string | null) => {
  const out = await scopedRule(async () => source, at(file), css, undefined, undefined, undefined, undefined, media, within);
  return out.ok ? out.change.after : out.reason;
};

describe('a component rule under a theme', () => {
  it('svelte puts a class theme in :global', async () => {
    expect(await write('src/Hero.svelte', SVELTE, { color: 'white' }, undefined, DARK)).toContain(':global(.dark) .lead {\n    color: white;\n  }');
  });

  it('svelte puts an attribute theme in :global', async () => {
    expect(await write('src/Hero.svelte', SVELTE, { color: 'white' }, undefined, FOREST)).toContain(':global([data-theme="forest"]) .lead');
  });

  it('vue writes the theme selector as it is', async () => {
    expect(await write('src/Hero.vue', VUE, { color: 'white' }, undefined, DARK)).toContain('\n  .dark .lead {\n    color: white;\n  }');
  });

  it('keeps the base rule apart from the theme rule', async () => {
    const first = (await write('src/Hero.vue', VUE, { color: 'white' }, undefined, DARK)) as string;
    const after = (await write('src/Hero.vue', first, { padding: '1px' }, undefined, null)) as string;
    expect(after).toContain('.lead {\n    padding: 1px;\n  }');
    expect(after).toContain('.dark .lead {\n    color: white;\n  }');
  });

  it('updates the same theme rule instead of adding another', async () => {
    const first = (await write('src/Hero.vue', VUE, { color: 'white' }, undefined, DARK)) as string;
    const after = (await write('src/Hero.vue', first, { color: 'black' }, undefined, DARK)) as string;
    expect(after.match(/\.dark \.lead/g)).toHaveLength(1);
    expect(after).toContain('color: black;');
  });

  it('a media theme writes into prefers-color-scheme', async () => {
    expect(await write('src/Hero.vue', VUE, { color: 'white' }, SCHEME, null)).toContain(`@media ${SCHEME} {\n    .lead {\n      color: white;\n    }\n  }`);
  });

  it('a media theme at a breakpoint writes one combined query', async () => {
    expect(await write('src/Hero.vue', VUE, { color: 'white' }, `(min-width: 768px) and ${SCHEME}`, null)).toContain(`@media (min-width: 768px) and ${SCHEME} {`);
  });
});

describe('a module rule under a theme', () => {
  const HERO = 'export const Hero = () => <p className={styles.heroP}>x</p>;\n';
  const files = (all: Record<string, string>) => async (path: string) => all[path] ?? null;

  it('puts the theme in :global so the module does not hash it', async () => {
    const out = await cssModuleRule(files({ 'src/Hero.tsx': HERO, 'src/Hero.module.css': '.heroP { padding: 1px; }\n' }), { file: 'src/Hero.tsx', line: 1, col: HERO.indexOf('<p') + 1 }, { color: 'white' }, undefined, undefined, undefined, undefined, undefined, DARK);
    expect(out.ok && out.changes.find((c) => c.path === 'src/Hero.module.css')?.after).toContain(':global(.dark) .heroP {');
  });
});

describe('a page rule under a theme', () => {
  const read = async (path: string) => (path === 'src/app.css' ? 'body { margin: 0; }\n' : null);

  it('body goes under the theme', async () => {
    const out = await pageRule(read, PageTarget.Body, { 'background-color': '#111' }, undefined, undefined, DARK);
    expect(out.ok && out.changes[0].after).toContain('.dark body {');
  });

  it('html carries the theme itself', async () => {
    const out = await pageRule(read, PageTarget.Html, { 'font-size': '18px' }, undefined, undefined, FOREST);
    expect(out.ok && out.changes[0].after).toContain('html[data-theme="forest"] {');
  });
});
