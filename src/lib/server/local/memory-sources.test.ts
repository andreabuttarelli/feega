import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEMORY_MAX_CHARS } from '$lib/onboarding/limits';
import { foundSources, projectOf, readSources } from './memory-sources';

async function places() {
  const home = await mkdtemp(join(tmpdir(), 'mem-home-'));
  const cwd = await mkdtemp(join(tmpdir(), 'mem-cwd-'));
  await mkdir(join(home, '.claude'));
  await writeFile(join(home, '.claude', 'CLAUDE.md'), 'be terse');
  await mkdir(join(home, '.codex'));
  await writeFile(join(home, '.codex', 'AGENTS.md'), '');
  await mkdir(join(home, '.cursor', 'rules'), { recursive: true });
  await mkdir(join(home, '.gemini'));
  await writeFile(join(home, '.gemini', 'GEMINI.md'), 'x'.repeat(201 * 1024));
  await writeFile(join(cwd, 'AGENTS.md'), 'repo rules');
  return { home, project: cwd };
}

describe('memory sources', () => {
  it('lists only existing, non-empty, small regular files', async () => {
    const at = await places();

    const found = await foundSources(at);

    expect(found.map((s) => s.id)).toEqual(['claude', 'project-agents']);
    expect(found[0]).toEqual({ id: 'claude', label: 'Claude Code', path: join(at.home, '.claude', 'CLAUDE.md'), bytes: 8 });
  });

  it('joins chosen files under their labels and ignores unknown ids', async () => {
    const at = await places();

    const content = await readSources(['claude', 'project-agents', '../../etc/passwd'], at);

    expect(content).toBe('## Claude Code\n\nbe terse\n\n## This folder: AGENTS.md\n\nrepo rules');
  });

  it('caps the total length', async () => {
    const at = await places();
    await writeFile(join(at.project, 'CLAUDE.md'), 'y'.repeat(MEMORY_MAX_CHARS + 500));

    expect((await readSources(['project-claude'], at)).length).toBe(MEMORY_MAX_CHARS);
  });
});

describe('the project folder', () => {
  it('is the folder of the open .feega file, not where the server was started', () => {
    expect(projectOf({ FEEGA_LOCAL_FILE: '/work/site/canvas.feega' }, '/app/bundle')).toBe('/work/site');
  });

  it('falls back to the server folder without a file', () => {
    expect(projectOf({}, '/app/bundle')).toBe('/app/bundle');
  });

  it("finds every place Claude Code keeps a project's memory", async () => {
    const home = await mkdtemp(join(tmpdir(), 'mem-home-'));
    const project = await mkdtemp(join(tmpdir(), 'mem-project-'));
    await writeFile(join(project, 'CLAUDE.md'), 'shared');
    await writeFile(join(project, 'CLAUDE.local.md'), 'mine');
    await mkdir(join(project, '.claude'));
    await writeFile(join(project, '.claude', 'CLAUDE.md'), 'nested');

    const found = await foundSources({ home, project });

    expect(found.map((s) => s.id)).toEqual(['project-claude', 'project-claude-local', 'project-claude-dir']);
  });
});
