import { describe, expect, it } from 'vitest';
import { linkWrite } from './link-edit';
import { literalText } from './literal-text';

const LIB_ALIAS = '$' + 'lib';

const LINKS = `export const HEADER_LINKS = [
  { href: '/download', label: 'Download' },
  { href: DOCS_URL, label: 'Docs' },
  { href: '/pricing', label: LABELS.pricing },
] as const;
`;

const SVELTE = `<script lang="ts">
  import { HEADER_LINKS } from '${LIB_ALIAS}/site/links';
</script>

<nav>
  {#each HEADER_LINKS as link}
    <a class="chip" href={link.href}>{link.label}</a>
  {/each}
</nav>
`;

const TSX = `import { HEADER_LINKS } from '../site/links';

export function Nav() {
  return (
    <nav>
      {HEADER_LINKS.map((link) => (
        <a key={link.href} href={link.href}>{link.label}</a>
      ))}
    </nav>
  );
}
`;

const TSX_DESTRUCTURED = TSX.replace('(link)', '({ href, label: text })').replace('href={link.href}>{link.label}', 'href={href}>{text}').replace('key={link.href}', 'key={href}');

const VUE = `<script setup lang="ts">
import { HEADER_LINKS } from '@/site/links';
</script>

<template>
  <nav>
    <a v-for="link in HEADER_LINKS" :key="link.href" :href="link.href">{{ link.label }}</a>
  </nav>
</template>
`;

const NESTED = SVELTE.replace('<a class="chip" href={link.href}>{link.label}</a>', '<li><a href={link.href}>{link.label}</a></li>');

const PLAIN = `const PLANS = ['a', 'b', 'c'];

export default function Page() {
  return (
    <ul>
      {PLANS.map((plan) => (
        <li key={plan}>{plan}</li>
      ))}
    </ul>
  );
}
`;

const read = (map: Record<string, string>) => async (path: string) => map[path] ?? null;

const SVELTE_PROJECT = { 'src/routes/+page.svelte': SVELTE, 'src/lib/site/links.ts': LINKS };

describe('text of a loop item', () => {
  it('writes the string literal of the entry behind {link.label}', async () => {
    const out = await literalText(read(SVELTE_PROJECT), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, 'Get it', 'Download', 0);

    expect(out.ok && out.changes.map((c) => c.path)).toEqual(['src/lib/site/links.ts']);
    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("label: 'Download'", "label: 'Get it'"));
  });

  it('writes the entry of the clicked instance only', async () => {
    const out = await literalText(read({ 'src/nav/Nav.tsx': TSX, 'src/site/links.ts': LINKS }), { file: 'src/nav/Nav.tsx', line: 7, col: 9 }, 'Get it', 'Download', 0);

    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("label: 'Download'", "label: 'Get it'"));
  });

  it('reads a destructured item parameter', async () => {
    const out = await literalText(read({ 'src/nav/Nav.tsx': TSX_DESTRUCTURED, 'src/site/links.ts': LINKS }), { file: 'src/nav/Nav.tsx', line: 7, col: 9 }, 'Get it', 'Download', 0);

    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("label: 'Download'", "label: 'Get it'"));
  });

  it('writes behind {{ link.label }} in Vue', async () => {
    const out = await literalText(read({ 'App.vue': VUE, 'src/site/links.ts': LINKS }), { file: 'App.vue', line: 7, col: 5 }, 'Get it', 'Download', 0);

    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("label: 'Download'", "label: 'Get it'"));
  });

  it('writes through a display transform such as .toLowerCase()', async () => {
    const page = SVELTE.replace('{link.label}', '{link.label.toLowerCase()}');
    const out = await literalText(read({ 'src/routes/+page.svelte': page, 'src/lib/site/links.ts': LINKS }), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, 'get it', 'download', 0);

    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("label: 'Download'", "label: 'get it'"));
  });

  it('refuses a call that is not a display transform', async () => {
    const page = SVELTE.replace('{link.label}', '{translate(link.label)}');
    const out = await literalText(read({ 'src/routes/+page.svelte': page, 'src/lib/site/links.ts': LINKS }), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, 'x', undefined, 0);

    expect(!out.ok && out.reason).toMatch(/translate/);
  });

  it('writes the string entry of a plain array behind {plan}', async () => {
    const out = await literalText(read({ 'a.tsx': PLAIN }), { file: 'a.tsx', line: 7, col: 9 }, 'z', 'b', 1);

    expect(out.ok && out.changes[0].after).toBe(PLAIN.replace("'b'", "'z'"));
  });

  it('writes from an element nested inside the loop item', async () => {
    const out = await literalText(read({ 'src/routes/+page.svelte': NESTED, 'src/lib/site/links.ts': LINKS }), { file: 'src/routes/+page.svelte', line: 7, col: 9 }, 'Get it', 'Download', 0);

    expect(out.ok && out.changes[0].path).toBe('src/lib/site/links.ts');
  });

  it('refuses a field that is a constant, naming it', async () => {
    const out = await literalText(read({ 'src/routes/+page.svelte': SVELTE.replace('{link.label}', '{link.href}'), 'src/lib/site/links.ts': LINKS }), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, 'x', undefined, 1);

    expect(!out.ok && out.reason).toMatch(/constant `DOCS_URL`/);
  });

  it('refuses a field that is an expression', async () => {
    const out = await literalText(read(SVELTE_PROJECT), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, 'x', undefined, 2);

    expect(!out.ok && out.reason).toMatch(/`LABELS.pricing`, an expression/);
  });

  it('refuses without the position of the item', async () => {
    const out = await literalText(read(SVELTE_PROJECT), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, 'x');

    expect(!out.ok && out.reason).toMatch(/position/);
  });

  it('keeps refusing text that does not come from the loop item', async () => {
    const out = await literalText(read({ 'src/routes/+page.svelte': SVELTE.replace('{link.label}', '{count}'), 'src/lib/site/links.ts': LINKS }), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, 'x', undefined, 0);

    expect(!out.ok && out.reason).toMatch(/`\{count\}`/);
  });
});

describe('link of a loop item', () => {
  it('writes the href literal of the entry behind href={link.href}', async () => {
    const out = await linkWrite(read(SVELTE_PROJECT), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, { href: '/get' }, 0);

    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("href: '/download'", "href: '/get'"));
  });

  it('writes behind :href in Vue', async () => {
    const out = await linkWrite(read({ 'App.vue': VUE, 'src/site/links.ts': LINKS }), { file: 'App.vue', line: 7, col: 5 }, { href: '/get' }, 0);

    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("href: '/download'", "href: '/get'"));
  });

  it('writes behind a destructured href in JSX', async () => {
    const out = await linkWrite(read({ 'src/nav/Nav.tsx': TSX_DESTRUCTURED, 'src/site/links.ts': LINKS }), { file: 'src/nav/Nav.tsx', line: 7, col: 9 }, { href: '/get' }, 0);

    expect(out.ok && out.changes[0].after).toBe(LINKS.replace("href: '/download'", "href: '/get'"));
  });

  it('refuses an href that is a constant, naming it', async () => {
    const out = await linkWrite(read(SVELTE_PROJECT), { file: 'src/routes/+page.svelte', line: 7, col: 5 }, { href: '/get' }, 1);

    expect(!out.ok && out.reason).toMatch(/constant `DOCS_URL`/);
  });
});
