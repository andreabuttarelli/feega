import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileEdits } from './file-edits';

function app() {
  const root = mkdtempSync(join(tmpdir(), 'agent-write-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/Page.svelte'), '<h1>Hi</h1>\n');
  return { root, read: (path: string) => readFileSync(join(root, path), 'utf8') };
}

describe('a file written by an AI agent', () => {
  it('lands in the history and undoes like any edit', async () => {
    const { root, read } = app();
    const edits = fileEdits(root);

    const out = await edits.agentWrite('src/Page.svelte', '<h1>Hello</h1>\n', 'Claude Code');

    expect(out.ok).toBe(true);
    expect(read('src/Page.svelte')).toBe('<h1>Hello</h1>\n');
    expect(edits.history()).toMatchObject([{ at: 'src/Page.svelte', prop: 'agent', value: 'Claude Code', files: ['src/Page.svelte'] }]);
    await edits.undo();
    expect(read('src/Page.svelte')).toBe('<h1>Hi</h1>\n');
  });

  it('creates a file that did not exist and removes it on undo', async () => {
    const { root, read } = app();
    const edits = fileEdits(root);

    await edits.agentWrite('src/New.svelte', '<p>new</p>\n', 'Codex');
    expect(read('src/New.svelte')).toBe('<p>new</p>\n');

    await edits.undo();
    expect(() => read('src/New.svelte')).toThrow();
  });

  it('refuses a path outside the workspace', async () => {
    const { root } = app();

    const out = await fileEdits(root).agentWrite('../outside.txt', 'x', 'Codex');

    expect(out).toMatchObject({ ok: false });
  });
});
