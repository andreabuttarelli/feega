import { describe, expect, it } from 'vitest';
import { AddKind, AddStyle, addedCss } from './add-node';
import { StructureOp, structure } from './structure';

const SVELTE = `<main>
  <h1>Title</h1>
  <section>
  </section>
</main>
`;

const JSX = `export default function Page() {
  return (
    <main>
      <h1>Title</h1>
      <section>
        <p>x</p>
      </section>
    </main>
  );
}
`;

const VUE = `<template>
  <main>
    <h1>Title</h1>
  </main>
</template>
`;

const LOOP = `<script>
  const xs = [1, 2];
</script>

<ul>
  {#each xs as x}
    <li>{x}</li>
  {/each}
</ul>
`;

const add = (text: string, file: string, line: number, col: number, kind: AddKind, style: AddStyle, src?: string) =>
  structure(async () => text, { op: StructureOp.Add, at: { file, line, col }, add: { kind, style, src } });

describe('addedCss', () => {
  it('gives the declarations a recipe carries, empty for an unstyled one', () => {
    expect(addedCss(AddKind.Heading)).toEqual({ 'font-size': '1.5rem', 'font-weight': '600' });
    expect(addedCss(AddKind.Text)).toEqual({});
  });
});

describe('add', () => {
  it('adds a Tailwind heading after the selected element and selects it', async () => {
    const out = await add(SVELTE, 'a.svelte', 2, 3, AddKind.Heading, AddStyle.Tailwind);

    expect(out.ok && out.changes[0].after).toBe(SVELTE.replace('  <h1>Title</h1>\n', '  <h1>Title</h1>\n  <h2 class="text-2xl font-semibold">Heading</h2>\n'));
    expect(out.ok && out.selected).toEqual({ file: 'a.svelte', line: 3, col: 3 });
  });

  it('adds inside the selected container, as its last child', async () => {
    const out = await add(SVELTE, 'a.svelte', 3, 3, AddKind.Text, AddStyle.Plain);

    expect(out.ok && out.changes[0].after).toBe(SVELTE.replace('  <section>\n  </section>', '  <section>\n    <p>Text</p>\n  </section>'));
  });

  it('writes no style in JSX, the project stylesheet gets the rule', async () => {
    const out = await add(JSX, 'page.tsx', 4, 7, AddKind.Button, AddStyle.Plain);

    expect(out.ok && out.changes[0].after).toContain('      <button>Button</button>\n');
  });

  it('writes className for Tailwind in JSX, inside a container', async () => {
    const out = await add(JSX, 'page.tsx', 5, 7, AddKind.Container, AddStyle.Tailwind);

    expect(out.ok && out.changes[0].after).toContain('        <p>x</p>\n        <div className="flex min-h-10 flex-col gap-2"></div>\n      </section>');
  });

  it('adds a link in Vue', async () => {
    const out = await add(VUE, 'App.vue', 3, 5, AddKind.Link, AddStyle.Plain);

    expect(out.ok && out.changes[0].after).toContain('    <h1>Title</h1>\n    <a href="#">Link</a>\n');
  });

  it('writes an img with the copied file and empty alt, never next/image', async () => {
    const out = await add(JSX, 'page.tsx', 4, 7, AddKind.Image, AddStyle.Plain, '/images/hero.png');

    expect(out.ok && out.changes[0].after).toContain('<img src="/images/hero.png" alt="" />');
  });

  it('refuses to add next to an element rendered by a loop', async () => {
    const out = await add(LOOP, 'a.svelte', 7, 5, AddKind.Text, AddStyle.Plain);

    expect(out.ok).toBe(false);
  });
});
