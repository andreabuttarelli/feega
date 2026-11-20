import { describe, expect, it } from 'vitest';
import { deleteNode, duplicateNode } from './structure';

const SVELTE = `<main>
  <h1>Title</h1>
  <p>Lead <b>bold</b></p>
</main>
`;

const JSX = `export default function Page() {
  return (
    <main className="a">
      <h1>Title</h1>
      <p>Lead</p>
    </main>
  );
}
`;

const VUE = `<template>
  <main>
    <h1>Title</h1>
    <p>Lead</p>
  </main>
</template>

<style scoped>
h1 { color: red; }
</style>
`;

const EACH = `<ul>
  {#each items as item}
    <li>{item}</li>
  {/each}
</ul>
`;

const at = (file: string, line: number, col: number) => ({ file, line, col });
const run = (op: typeof deleteNode, text: string, file: string, line: number, col: number) => op(async () => text, at(file, line, col));

describe('deleteNode', () => {
  it('removes a Svelte element with its subtree and its line', async () => {
    const out = await run(deleteNode, SVELTE, 'a.svelte', 3, 3);

    expect(out.ok && out.change.after).toBe('<main>\n  <h1>Title</h1>\n</main>\n');
  });

  it('removes a JSX element', async () => {
    const out = await run(deleteNode, JSX, 'page.tsx', 4, 7);

    expect(out.ok && out.change.after).toBe(JSX.replace('      <h1>Title</h1>\n', ''));
  });

  it('removes a Vue element and leaves the style untouched', async () => {
    const out = await run(deleteNode, VUE, 'App.vue', 3, 5);

    expect(out.ok && out.change.after).toBe(VUE.replace('    <h1>Title</h1>\n', ''));
  });

  it('refuses an element rendered by a loop', async () => {
    const out = await run(deleteNode, EACH, 'a.svelte', 3, 5);

    expect(out.ok).toBe(false);
  });
});

describe('duplicateNode', () => {
  it('copies a Svelte element right after itself', async () => {
    const out = await run(duplicateNode, SVELTE, 'a.svelte', 2, 3);

    expect(out.ok && out.change.after).toBe('<main>\n  <h1>Title</h1>\n  <h1>Title</h1>\n  <p>Lead <b>bold</b></p>\n</main>\n');
  });

  it('copies a JSX element', async () => {
    const out = await run(duplicateNode, JSX, 'page.tsx', 5, 7);

    expect(out.ok && out.change.after).toBe(JSX.replace('      <p>Lead</p>\n', '      <p>Lead</p>\n      <p>Lead</p>\n'));
  });

  it('copies a Vue element', async () => {
    const out = await run(duplicateNode, VUE, 'App.vue', 4, 5);

    expect(out.ok && out.change.after).toBe(VUE.replace('    <p>Lead</p>\n', '    <p>Lead</p>\n    <p>Lead</p>\n'));
  });
});
