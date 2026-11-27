import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { watchProject, type Batch } from './project-watch';

const DEBOUNCE_MS = 60;
const SETTLE_MS = 600;
const SILENCE_MS = 500;
const ARM_MS = 300;
const FIXTURE_SETTLE_MS = 400;

const closers: (() => void)[] = [];

afterEach(() => closers.splice(0).forEach((close) => close()));

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function watched(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'feega-project-watch-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  await pause(FIXTURE_SETTLE_MS);
  const batches: Batch[] = [];
  const handle = watchProject(root, (batch) => batches.push(batch), { debounceMs: DEBOUNCE_MS });
  closers.push(handle.dispose);
  await pause(ARM_MS);
  return { root, batches, handle };
}

const structureOf = (batches: Batch[]) => batches.flatMap((b) => b.structure);

describe('watchProject', () => {
  it('reports a source file that appears as a structure change', async () => {
    const { root, batches } = await watched();

    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/Card.svelte'), '<div />');
    await pause(SETTLE_MS);

    expect(structureOf(batches)).toContain('src/Card.svelte');
  });

  it('reports a source file that goes away as a structure change', async () => {
    const { root, batches } = await watched({ 'src/Card.svelte': '<div />' });

    rmSync(join(root, 'src/Card.svelte'));
    await pause(SETTLE_MS);

    expect(structureOf(batches)).toContain('src/Card.svelte');
  });

  it('reports both names of a rename', async () => {
    const { root, batches } = await watched({ 'src/Card.svelte': '<div />' });

    renameSync(join(root, 'src/Card.svelte'), join(root, 'src/Tile.svelte'));
    await pause(SETTLE_MS);

    expect(structureOf(batches)).toEqual(expect.arrayContaining(['src/Card.svelte', 'src/Tile.svelte']));
  });

  it('reports an edit of an existing file as a content change, not a structure one', async () => {
    const { root, batches } = await watched({ 'src/Card.svelte': '<div />' });

    writeFileSync(join(root, 'src/Card.svelte'), '<div>edited</div>');
    await pause(SETTLE_MS);

    expect(batches.flatMap((b) => b.content)).toContain('src/Card.svelte');
    expect(structureOf(batches)).not.toContain('src/Card.svelte');
  });

  it('answers many quick writes with one batch', async () => {
    const { root, batches } = await watched();

    for (const name of ['A', 'B', 'C']) {
      writeFileSync(join(root, `${name}.svelte`), '<i />');
    }
    await pause(SETTLE_MS);

    expect(batches).toHaveLength(1);
    expect(structureOf(batches).sort()).toEqual(['A.svelte', 'B.svelte', 'C.svelte']);
  });

  it('ignores node_modules, build folders and files that are not source', async () => {
    const { root, batches } = await watched({ 'node_modules/x/y.js': '1' });

    writeFileSync(join(root, 'node_modules/x/z.js'), '2');
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist/app.js'), '3');
    writeFileSync(join(root, 'notes.txt'), '4');
    await pause(SILENCE_MS);

    expect(batches).toEqual([]);
  });

  it('says nothing after dispose', async () => {
    const { root, batches, handle } = await watched();

    handle.dispose();
    writeFileSync(join(root, 'Late.svelte'), '<i />');
    await pause(SILENCE_MS);

    expect(batches).toEqual([]);
  });
});
