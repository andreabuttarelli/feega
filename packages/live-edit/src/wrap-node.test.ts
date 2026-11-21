import { describe, expect, it } from 'vitest';
import { AddStyle } from './add-node';
import { WrapTag, wrapperCss } from './wrap-node';
import { StructureOp, structure } from './structure';

const SVELTE = `<main>
  <h1 class="t">Title</h1>
  <p>Lead</p>
</main>
`;

const JSX = `export default function Page() {
  return (
    <main>
      <h1 className="t">Title</h1>
      <p>Lead</p>
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

const run = (op: StructureOp, text: string, file: string, line: number, col: number, style = AddStyle.Plain, wrap?: WrapTag) => structure(async () => text, { op, at: { file, line, col }, style, wrap });

describe('wrap and unwrap', () => {
  it('wraps a Svelte element in a div and selects the new container', async () => {
    const out = await run(StructureOp.Wrap, SVELTE, 'a.svelte', 2, 3);

    expect(out.ok && out.changes[0].after).toBe('<main>\n  <div>\n    <h1 class="t">Title</h1>\n  </div>\n  <p>Lead</p>\n</main>\n');
    expect(out.ok && out.selected).toEqual({ file: 'a.svelte', line: 2, col: 3 });
  });

  it('gives the container flex classes in Tailwind, in either attribute', async () => {
    const svelte = await run(StructureOp.Wrap, SVELTE, 'a.svelte', 2, 3, AddStyle.Tailwind);
    const jsx = await run(StructureOp.Wrap, JSX, 'page.tsx', 5, 7, AddStyle.Tailwind);

    expect(svelte.ok && svelte.changes[0].after).toContain('  <div class="flex flex-col">\n    <h1 class="t">Title</h1>');
    expect(jsx.ok && jsx.changes[0].after).toContain('      <div className="flex flex-col">\n        <p>Lead</p>');
  });

  it('wraps a JSX element with several lines', async () => {
    const out = await run(StructureOp.Wrap, JSX, 'page.tsx', 5, 7);

    expect(out.ok && out.changes[0].after).toContain('      <h1 className="t">Title</h1>\n      <div>\n        <p>Lead</p>\n      </div>\n');
  });

  it('wraps a Vue element', async () => {
    const out = await run(StructureOp.Wrap, VUE, 'App.vue', 3, 5);

    expect(out.ok && out.changes[0].after).toContain('  <main>\n    <div>\n      <h1>Title</h1>\n    </div>\n  </main>');
  });

  it('unwraps a container and gives its children back to the parent', async () => {
    const wrapped = '<main>\n  <div>\n    <h1 class="t">Title</h1>\n    <p>Lead</p>\n  </div>\n</main>\n';
    const out = await run(StructureOp.Unwrap, wrapped, 'a.svelte', 2, 3);

    expect(out.ok && out.changes[0].after).toBe(SVELTE);
  });

  it('unwraps a JSX container', async () => {
    const wrapped = JSX.replace('      <h1 className="t">Title</h1>\n      <p>Lead</p>\n', '      <div>\n        <h1 className="t">Title</h1>\n        <p>Lead</p>\n      </div>\n');
    const out = await run(StructureOp.Unwrap, wrapped, 'page.tsx', 4, 7);

    expect(out.ok && out.changes[0].after).toBe(JSX);
  });

  it('refuses to wrap an element rendered by a loop', async () => {
    const out = await run(StructureOp.Wrap, LOOP, 'a.svelte', 7, 5);

    expect(out.ok).toBe(false);
  });
});

describe('wrap with a chosen tag', () => {
  it('wraps a Svelte element in a section', async () => {
    const out = await run(StructureOp.Wrap, SVELTE, 'a.svelte', 2, 3, AddStyle.Plain, WrapTag.Section);

    expect(out.ok && out.changes[0].after).toBe('<main>\n  <section>\n    <h1 class="t">Title</h1>\n  </section>\n  <p>Lead</p>\n</main>\n');
  });

  it('wraps JSX in a link with an href and no layout classes', async () => {
    const out = await run(StructureOp.Wrap, JSX, 'page.tsx', 5, 7, AddStyle.Tailwind, WrapTag.Link);

    expect(out.ok && out.changes[0].after).toContain('      <a href="#">\n        <p>Lead</p>\n      </a>\n');
  });

  it('wraps a Vue element in a button', async () => {
    const out = await run(StructureOp.Wrap, VUE, 'App.vue', 3, 5, AddStyle.Plain, WrapTag.Button);

    expect(out.ok && out.changes[0].after).toContain('    <button>\n      <h1>Title</h1>\n    </button>');
  });

  it('gives container tags the Tailwind column classes', async () => {
    const out = await run(StructureOp.Wrap, SVELTE, 'a.svelte', 2, 3, AddStyle.Tailwind, WrapTag.Nav);

    expect(out.ok && out.changes[0].after).toContain('<nav class="flex flex-col">');
  });

  it('declares the plain-CSS layout only for container tags', () => {
    expect(wrapperCss(WrapTag.Section)).toEqual({ display: 'flex', 'flex-direction': 'column' });
    expect(wrapperCss(WrapTag.Link)).toEqual({});
  });
});
