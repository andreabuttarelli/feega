import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { StructureOp } from '@feega/live-edit/structure';
import { fileEdits } from './file-edits';

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } });
const PLAIN = JSON.stringify({ devDependencies: { vite: '^5.0.0' } });
const LIST = '<ul>\n  <li>a</li>\n  <li>b</li>\n  <li>c</li>\n</ul>\n';
const TSX = 'export default function Page() {\n  return (\n    <main>\n      <h1>Title</h1>\n      <p>Lead</p>\n    </main>\n  );\n}\n';
const VUE = '<template>\n  <main>\n    <h1>Title</h1>\n    <p>Lead</p>\n  </main>\n</template>\n';
const LOOP = '<script>\n  const xs = [1, 2];\n</script>\n<h1>T</h1>\n<ul>\n  {#each xs as x}\n    <li>{x}</li>\n  {/each}\n</ul>\n';

const at = (path: string, line: number, col: number) => ({ at: `${path}:${line}:${col}` });
const file = (root: string, name: string) => readFileSync(join(root, 'src', name), 'utf8');

function project(manifest = TAILWIND): string {
  const root = mkdtempSync(join(tmpdir(), 'inspect-many-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
  writeFileSync(join(root, 'src/List.svelte'), LIST);
  writeFileSync(join(root, 'src/Page.tsx'), TSX);
  writeFileSync(join(root, 'src/App.vue'), VUE);
  writeFileSync(join(root, 'src/Loop.svelte'), LOOP);
  return root;
}

describe('fileEdits.structureMany', () => {
  it('deleting elements of three files is one undo step', async () => {
    const root = project();
    const edits = fileEdits(root);
    const out = await edits.structureMany({ op: StructureOp.Delete, targets: [at('src/List.svelte', 2, 3), at('src/List.svelte', 4, 3), at('src/Page.tsx', 4, 7), at('src/App.vue', 3, 5)] });

    expect(out.ok).toBe(true);
    expect(file(root, 'List.svelte')).toBe('<ul>\n  <li>b</li>\n</ul>\n');
    expect(file(root, 'Page.tsx')).not.toContain('<h1>');
    expect(file(root, 'App.vue')).not.toContain('<h1>');
    expect(edits.history()).toHaveLength(1);

    await edits.undo();

    expect(file(root, 'List.svelte')).toBe(LIST);
    expect(file(root, 'Page.tsx')).toBe(TSX);
    expect(file(root, 'App.vue')).toBe(VUE);
    expect(edits.canUndo()).toBe(false);
  });

  it('redo applies the whole batch again', async () => {
    const root = project();
    const edits = fileEdits(root);
    await edits.structureMany({ op: StructureOp.Delete, targets: [at('src/List.svelte', 2, 3), at('src/Page.tsx', 4, 7)] });
    await edits.undo();
    await edits.redo();

    expect(file(root, 'List.svelte')).toBe('<ul>\n  <li>b</li>\n  <li>c</li>\n</ul>\n');
    expect(file(root, 'Page.tsx')).not.toContain('<h1>');
  });

  it('duplicates two elements in one step', async () => {
    const root = project();
    const edits = fileEdits(root);
    await edits.structureMany({ op: StructureOp.Duplicate, targets: [at('src/List.svelte', 2, 3), at('src/List.svelte', 3, 3)] });

    expect(file(root, 'List.svelte')).toBe('<ul>\n  <li>a</li>\n  <li>a</li>\n  <li>b</li>\n  <li>b</li>\n  <li>c</li>\n</ul>\n');
    await edits.undo();
    expect(file(root, 'List.svelte')).toBe(LIST);
  });

  it('wraps two siblings in one container with its flex classes, undone in one step', async () => {
    const root = project();
    const edits = fileEdits(root);
    const out = await edits.structureMany({ op: StructureOp.Wrap, targets: [at('src/List.svelte', 2, 3), at('src/List.svelte', 3, 3)] });

    expect(out.ok).toBe(true);
    expect(file(root, 'List.svelte')).toBe('<ul>\n  <div class="flex flex-col">\n    <li>a</li>\n    <li>b</li>\n  </div>\n  <li>c</li>\n</ul>\n');
    await edits.undo();
    expect(file(root, 'List.svelte')).toBe(LIST);
  });

  it('wrapping without Tailwind writes the container rule in the same step', async () => {
    const root = project(PLAIN);
    const edits = fileEdits(root);
    await edits.structureMany({ op: StructureOp.Wrap, targets: [at('src/List.svelte', 2, 3), at('src/List.svelte', 3, 3)] });

    expect(file(root, 'List.svelte')).toMatch(/<div class="[\w-]+">\n {4}<li>a<\/li>/);
    expect(file(root, 'List.svelte')).toMatch(/flex-direction: column;/);
    await edits.undo();
    expect(file(root, 'List.svelte')).toBe(LIST);
  });

  it('refuses a wrap of elements that are not adjacent and writes nothing', async () => {
    const root = project();
    const edits = fileEdits(root);
    const out = await edits.structureMany({ op: StructureOp.Wrap, targets: [at('src/List.svelte', 2, 3), at('src/List.svelte', 4, 3)] });

    expect(!out.ok && out.reason).toContain('next to each other');
    expect(file(root, 'List.svelte')).toBe(LIST);
    expect(edits.canUndo()).toBe(false);
  });

  it('skips what cannot be edited, says why, and edits the rest', async () => {
    const root = project();
    const edits = fileEdits(root);
    const out = await edits.structureMany({ op: StructureOp.Delete, targets: [at('src/Loop.svelte', 4, 1), at('src/Loop.svelte', 7, 5)] });

    expect(out.ok && out.note).toMatch(/1 of 2 changed/);
    expect(file(root, 'Loop.svelte')).not.toContain('<h1>');
    expect(file(root, 'Loop.svelte')).toContain('<li>{x}</li>');
  });

  it('refuses a target outside the workspace', async () => {
    const root = project();
    const out = await fileEdits(root).structureMany({ op: StructureOp.Delete, targets: [at('../elsewhere/Page.svelte', 2, 3)] });

    expect(out.ok).toBe(false);
  });
});
