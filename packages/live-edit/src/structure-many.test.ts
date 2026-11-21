import { describe, expect, it } from 'vitest';
import { StructureOp } from './structure';
import { structureMany, type Batched } from './structure-many';
import { WrapTag } from './wrap-node';

const SVELTE = `<main>
  <h1>Title</h1>
  <p>Lead</p>
  <footer>End</footer>
  <aside>Side</aside>
</main>
`;

const JSX = `export default function Page() {
  return (
    <main>
      <h1>Title</h1>
      <p>Lead</p>
      <footer>End</footer>
    </main>
  );
}
`;

const VUE = `<template>
  <main>
    <h1>Title</h1>
    <p>Lead</p>
    <footer>End</footer>
  </main>
</template>
`;

const EACH = `<script>
  const xs = [1, 2];
</script>

<h1>Title</h1>
<ul>
  {#each xs as x}
    <li>{x}</li>
  {/each}
</ul>
`;

const TALL = `<script>
  const xs = [
    1,
    2,
    3
  ];
</script>

<h1>Title</h1>
<ul>
  {#each xs as x}
    <li>{x}</li>
  {/each}
</ul>
<p>Last</p>
`;

const files: Record<string, string> = { 'a.svelte': SVELTE, 'page.tsx': JSX, 'App.vue': VUE, 'each.svelte': EACH, 'tall.svelte': TALL };
const read = async (path: string) => files[path] ?? null;
const at = (file: string, line: number, col: number) => ({ at: { file, line, col } });
const after = (out: Batched, file: string) => (out.ok ? out.changes.find((c) => c.path === file) : undefined);

describe('structureMany', () => {
  it('deletes several elements of one file in one change, whatever the order given', async () => {
    const out = await structureMany(read, { op: StructureOp.Delete, targets: [at('a.svelte', 2, 3), at('a.svelte', 4, 3), at('a.svelte', 3, 3)] });

    expect(out.ok && out.changes).toHaveLength(1);
    expect(after(out, 'a.svelte')).toEqual({ path: 'a.svelte', before: SVELTE, after: '<main>\n  <aside>Side</aside>\n</main>\n' });
  });

  it('deletes in Svelte, JSX and Vue files at once, one change per file', async () => {
    const out = await structureMany(read, {
      op: StructureOp.Delete,
      targets: [at('a.svelte', 2, 3), at('a.svelte', 4, 3), at('page.tsx', 4, 7), at('page.tsx', 6, 7), at('App.vue', 3, 5)]
    });

    expect(out.ok && out.changes.map((c) => c.path).sort()).toEqual(['App.vue', 'a.svelte', 'page.tsx']);
    expect(after(out, 'a.svelte')?.after).toBe('<main>\n  <p>Lead</p>\n  <aside>Side</aside>\n</main>\n');
    expect(after(out, 'page.tsx')?.after).toBe(JSX.replace('      <h1>Title</h1>\n', '').replace('      <footer>End</footer>\n', ''));
    expect(after(out, 'App.vue')?.after).toBe(VUE.replace('    <h1>Title</h1>\n', ''));
  });

  it('duplicates every target after itself', async () => {
    const out = await structureMany(read, { op: StructureOp.Duplicate, targets: [at('a.svelte', 2, 3), at('a.svelte', 3, 3)] });

    expect(after(out, 'a.svelte')?.after).toBe('<main>\n  <h1>Title</h1>\n  <h1>Title</h1>\n  <p>Lead</p>\n  <p>Lead</p>\n  <footer>End</footer>\n  <aside>Side</aside>\n</main>\n');
  });

  it('skips an element rendered by a loop, with its reason, and edits the rest', async () => {
    const out = await structureMany(read, { op: StructureOp.Delete, targets: [at('each.svelte', 5, 1), at('each.svelte', 8, 5)] });

    expect(out.ok && out.skipped.map((s) => s.at)).toEqual([{ file: 'each.svelte', line: 8, col: 5 }]);
    expect(out.ok && out.skipped[0].reason).toBeTruthy();
    expect(after(out, 'each.svelte')?.after).not.toContain('<h1>');
  });

  it('keeps positions valid when a loop item shortens the script above the other targets', async () => {
    const out = await structureMany(read, { op: StructureOp.Delete, targets: [{ ...at('tall.svelte', 12, 5), instance: 1 }, at('tall.svelte', 9, 1), at('tall.svelte', 15, 1)] });

    expect(after(out, 'tall.svelte')?.after).toBe(TALL.replace('    2,\n', '').replace('<h1>Title</h1>\n', '').replace('<p>Last</p>\n', ''));
  });

  it('refuses when no element can be edited', async () => {
    const out = await structureMany(read, { op: StructureOp.Delete, targets: [at('each.svelte', 8, 5), at('missing.svelte', 1, 1)] });

    expect(out.ok).toBe(false);
  });

  it('wraps adjacent siblings in one container, in Svelte, JSX and Vue', async () => {
    const svelte = await structureMany(read, { op: StructureOp.Wrap, targets: [at('a.svelte', 3, 3), at('a.svelte', 2, 3)] });
    const jsx = await structureMany(read, { op: StructureOp.Wrap, targets: [at('page.tsx', 4, 7), at('page.tsx', 5, 7)] });
    const vue = await structureMany(read, { op: StructureOp.Wrap, targets: [at('App.vue', 4, 5), at('App.vue', 5, 5)] });

    expect(after(svelte, 'a.svelte')?.after).toBe('<main>\n  <div>\n    <h1>Title</h1>\n    <p>Lead</p>\n  </div>\n  <footer>End</footer>\n  <aside>Side</aside>\n</main>\n');
    expect(after(jsx, 'page.tsx')?.after).toContain('      <div>\n        <h1>Title</h1>\n        <p>Lead</p>\n      </div>\n      <footer>End</footer>');
    expect(after(vue, 'App.vue')?.after).toContain('    <h1>Title</h1>\n    <div>\n      <p>Lead</p>\n      <footer>End</footer>\n    </div>');
    expect(svelte.ok && svelte.selected).toEqual({ file: 'a.svelte', line: 2, col: 3 });
  });

  it('wraps with the chosen tag', async () => {
    const out = await structureMany(read, { op: StructureOp.Wrap, targets: [at('a.svelte', 2, 3), at('a.svelte', 3, 3)], wrap: WrapTag.Section });

    expect(after(out, 'a.svelte')?.after).toContain('<section>');
  });

  it('refuses to wrap siblings that are not next to each other', async () => {
    const out = await structureMany(read, { op: StructureOp.Wrap, targets: [at('a.svelte', 2, 3), at('a.svelte', 4, 3)] });

    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toContain('next to each other');
  });

  it('refuses to wrap elements of different parents or files', async () => {
    const parents = await structureMany(read, { op: StructureOp.Wrap, targets: [at('page.tsx', 3, 5), at('page.tsx', 4, 7)] });
    const apart = await structureMany(read, { op: StructureOp.Wrap, targets: [at('a.svelte', 2, 3), at('App.vue', 3, 5)] });

    expect(!parents.ok && parents.reason).toContain('same parent');
    expect(!apart.ok && apart.reason).toContain('same file');
  });

  it('wraps one element like wrapping it alone', async () => {
    const out = await structureMany(read, { op: StructureOp.Wrap, targets: [at('a.svelte', 2, 3)] });

    expect(after(out, 'a.svelte')?.after).toBe('<main>\n  <div>\n    <h1>Title</h1>\n  </div>\n  <p>Lead</p>\n  <footer>End</footer>\n  <aside>Side</aside>\n</main>\n');
  });

  it('unwraps every target', async () => {
    const nested = '<main>\n  <div>\n    <h1>Title</h1>\n  </div>\n  <section>\n    <p>Lead</p>\n  </section>\n</main>\n';
    const out = await structureMany(async () => nested, { op: StructureOp.Unwrap, targets: [at('n.svelte', 2, 3), at('n.svelte', 5, 3)] });

    expect(out.ok && out.changes[0].after).toBe('<main>\n  <h1>Title</h1>\n  <p>Lead</p>\n</main>\n');
  });
});
