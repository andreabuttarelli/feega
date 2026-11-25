import { describe, expect, it } from 'vitest';
import { applyProps, type PropsAsk } from './apply-props';

type Case = { framework: string; file: string; component: string; page: (tag: string) => string; tag: string };

const wrap = (before: string, after: string) => (tag: string) => `${before}${tag}${after}`;

const CASES: Case[] = [
  { framework: 'JSX', file: 'src/Home.tsx', component: 'src/Card.tsx', page: wrap("import Card from './Card';\n\nexport default () => (\n  <main>\n    ", '\n  </main>\n);\n'), tag: '<Card title="Old" size={2} />' },
  { framework: 'Vue', file: 'src/Home.vue', component: 'src/Card.vue', page: wrap("<script setup>\nimport Card from './Card.vue';\n</script>\n\n<template>\n  <main>\n    ", '\n  </main>\n</template>\n'), tag: '<Card title="Old" :size="2" />' },
  { framework: 'Svelte', file: 'src/Home.svelte', component: 'src/Card.svelte', page: wrap("<script>\n  import Card from './Card.svelte';\n</script>\n\n<main>\n  ", '\n</main>\n'), tag: '<Card title="Old" size={2} />' },
  { framework: 'Astro', file: 'src/Home.astro', component: 'src/Card.astro', page: wrap("---\nimport Card from './Card.astro';\n---\n<main>\n  ", '\n</main>\n'), tag: '<Card title="Old" size={2} />' }
];

const SETS: Record<string, { set: Record<string, unknown>; expected: Record<string, string> }> = {
  string: { set: { title: 'New' }, expected: { JSX: 'title="New"', Vue: 'title="New"', Svelte: 'title="New"', Astro: 'title="New"' } },
  number: { set: { size: 5 }, expected: { JSX: 'size={5}', Vue: ':size="5"', Svelte: 'size={5}', Astro: 'size={5}' } },
  boolean: { set: { open: true }, expected: { JSX: ' open', Vue: ' open', Svelte: ' open', Astro: ' open' } },
  false: { set: { open: false }, expected: { JSX: 'open={false}', Vue: ':open="false"', Svelte: 'open={false}', Astro: 'open={false}' } },
  array: { set: { tags: ['a', 'b'] }, expected: { JSX: 'tags={["a","b"]}', Vue: ":tags='[\"a\",\"b\"]'", Svelte: 'tags={["a","b"]}', Astro: 'tags={["a","b"]}' } },
  object: { set: { style: { w: 1 } }, expected: { JSX: 'style={{"w":1}}', Vue: ":style='{\"w\":1}'", Svelte: 'style={{"w":1}}', Astro: 'style={{"w":1}}' } },
  date: { set: { when: { $date: '2026-01-01T00:00:00.000Z' } }, expected: { JSX: 'when={new Date("2026-01-01T00:00:00.000Z")}', Vue: ":when='new Date(\"2026-01-01T00:00:00.000Z\")'", Svelte: 'when={new Date("2026-01-01T00:00:00.000Z")}', Astro: 'when={new Date("2026-01-01T00:00:00.000Z")}' } }
};

const run = async (c: Case, tag: string, ask: Partial<PropsAsk>, which?: PropsAsk['which']) => {
  const page = c.page(tag);
  const parentLine = page.split('\n').findIndex((l) => l.includes('<main')) + 1;
  const col = page.split('\n')[parentLine - 1].indexOf('<main') + 1;
  const files: Record<string, string> = { [c.file]: page };

  return applyProps(async (path) => files[path] ?? null, { component: c.component, usage: { file: c.file, line: parentLine, col }, which, set: {}, remove: [], ...ask });
};

describe.each(CASES)('apply to page in $framework', (c) => {
  it.each(Object.entries(SETS))('writes a %s prop as an attribute', async (_name, { set, expected }) => {
    const out = await run(c, c.tag, { set: set as PropsAsk['set'] });

    expect(out.ok && out.change.after).toContain(expected[c.framework]);
  });

  it('replaces the literal that is there', async () => {
    const out = await run(c, c.tag, { set: { title: 'New' } });

    expect(out.ok && out.change.after).toContain('title="New"');
    expect(out.ok && out.change.after).not.toContain('Old');
  });

  it('removes an attribute when the value is back to the default', async () => {
    const out = await run(c, c.tag, { remove: ['title'] });

    expect(out.ok && out.change.after).not.toContain('title=');
    expect(out.ok && out.change.after).toContain('Card');
  });

  it('leaves the file alone when nothing is to write', async () => {
    const out = await run(c, c.tag, { remove: ['missing'] });

    expect(out.ok && out.change.after).toBe(out.ok && out.change.before);
  });

  it('asks before replacing an expression', async () => {
    const dynamic = c.framework === 'Vue' ? '<Card :title="post.title" />' : '<Card title={post.title} />';
    const out = await run(c, dynamic, { set: { title: 'New' } });

    expect(out.ok && out.cautions).toEqual([expect.stringContaining('title')]);
  });

  it('asks when the usage spreads props', async () => {
    const spread = c.framework === 'Vue' ? '<Card v-bind="rest" />' : '<Card {...rest} />';
    const out = await run(c, spread, { set: { title: 'New' } });

    expect(out.ok && out.cautions).toEqual([expect.stringContaining('spread')]);
  });

  it('skips callbacks and children with a note', async () => {
    const out = await run(c, c.tag, { set: { children: 'x', onClick: { $fn: true } } });

    expect(out.ok && out.skipped.sort()).toEqual(['children', 'onClick']);
  });

  it('keeps the other props', async () => {
    const out = await run(c, c.tag, { set: { title: 'New' } });

    expect(out.ok && out.change.after).toMatch(/size/);
  });
});

describe('apply to page limits', () => {
  it('refuses a usage that is not found', async () => {
    const c = CASES[0];
    const out = await run(c, '<Other />', { set: { title: 'x' } });

    expect(out.ok).toBe(false);
  });

  it('asks when the usage is rendered in a loop', async () => {
    const c = CASES[0];
    const out = await run(c, '{items.map((i) => <Card title="Old" />)}', { set: { title: 'New' } });

    expect(out.ok && out.cautions).toEqual([expect.stringContaining('loop')]);
  });
});
