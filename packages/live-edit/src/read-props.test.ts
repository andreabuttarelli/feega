import { describe, expect, it } from 'vitest';
import { readProps } from './read-props';

type Case = { framework: string; file: string; component: string; page: (tag: string) => string; syntax: Record<string, string> };

const wrap = (before: string, after: string) => (tag: string) => `${before}${tag}${after}`;

const BRACED = { string: 'title="Hi"', number: 'size={3}', flag: 'open', no: 'open={false}', array: 'tags={["a", "b"]}', object: 'style={{ w: 1, "h": 2 }}', date: 'when={new Date("2026-01-01T00:00:00.000Z")}', single: "name='Ada'", expr: 'title={post.title}', interpolated: 'title="a {b}"' };

const CASES: Case[] = [
  { framework: 'Svelte', file: 'src/Home.svelte', component: 'src/Card.svelte', page: wrap("<script>\n  import Card from './Card.svelte';\n</script>\n\n<main>\n  ", '\n</main>\n'), syntax: BRACED },
  { framework: 'Astro', file: 'src/Home.astro', component: 'src/Card.astro', page: wrap("---\nimport Card from './Card.astro';\n---\n<main>\n  ", '\n</main>\n'), syntax: { ...BRACED, interpolated: 'title={`a ${b}`}' } },
  { framework: 'JSX', file: 'src/Home.tsx', component: 'src/Card.tsx', page: wrap("import Card from './Card';\n\nexport default () => (\n  <main>\n    ", '\n  </main>\n);\n'), syntax: { ...BRACED, interpolated: 'title={`a ${b}`}' } },
  { framework: 'Vue', file: 'src/Home.vue', component: 'src/Card.vue', page: wrap("<script setup>\nimport Card from './Card.vue';\n</script>\n\n<template>\n  <main>\n    ", '\n  </main>\n</template>\n'), syntax: { ...BRACED, number: ':size="3"', no: ':open="false"', array: ':tags=\'["a", "b"]\'', object: ':style=\'{ w: 1, "h": 2 }\'', date: ':when=\'new Date("2026-01-01T00:00:00.000Z")\'', expr: ':title="post.title"', interpolated: ':title="`a ${b}`"' } }
];

const read = (c: Case, attributes: string) => {
  const page = c.page(`<Card ${attributes} />`);
  const parentLine = page.split('\n').findIndex((l) => l.includes('<main')) + 1;
  const col = page.split('\n')[parentLine - 1].indexOf('<main') + 1;
  return readProps(async (path) => (path === c.file ? page : null), { component: c.component, usage: { file: c.file, line: parentLine, col } });
};

describe.each(CASES)('props at the usage in $framework', (c) => {
  it('reads literals', async () => {
    const out = await read(c, `${c.syntax.string} ${c.syntax.number} ${c.syntax.flag} ${c.syntax.single}`);

    expect(out).toEqual({ ok: true, values: { title: 'Hi', size: 3, open: true, name: 'Ada' }, dynamic: [], spread: false });
  });

  it('reads false, arrays, objects and dates', async () => {
    const out = await read(c, `${c.syntax.no} ${c.syntax.array} ${c.syntax.object} ${c.syntax.date}`);

    expect(out.ok && out.values).toEqual({ open: false, tags: ['a', 'b'], style: { w: 1, h: 2 }, when: { $date: '2026-01-01T00:00:00.000Z' } });
  });

  it('marks an expression as dynamic and gives no value', async () => {
    const out = await read(c, `${c.syntax.expr} ${c.syntax.number}`);

    expect(out).toMatchObject({ ok: true, values: { size: 3 }, dynamic: ['title'] });
  });

  it('marks an interpolated string as dynamic', async () => {
    const out = await read(c, c.syntax.interpolated);

    expect(out.ok && out.dynamic).toEqual(['title']);
  });

  it('says when props are spread', async () => {
    const out = await read(c, c.framework === 'Vue' ? 'v-bind="rest"' : '{...rest}');

    expect(out.ok && out.spread).toBe(true);
  });
});

describe('props at the usage', () => {
  it('reads the shorthand of Svelte as dynamic', async () => {
    const c = CASES[0];

    expect((await read(c, '{title}')).ok && (await read(c, '{title}'))).toMatchObject({ dynamic: ['title'] });
  });

  it('refuses a usage that is not found', async () => {
    const page = "<script>\n  import Card from './Card.svelte';\n</script>\n<main><p /></main>\n";

    const out = await readProps(async () => page, { component: 'src/Card.svelte', usage: { file: 'src/Home.svelte', line: 4, col: 1 } });

    expect(out.ok).toBe(false);
  });
});
