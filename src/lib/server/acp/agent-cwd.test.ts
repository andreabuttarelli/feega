import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agentCwd } from './agent-cwd';

function project() {
  const home = mkdtempSync(join(tmpdir(), 'agent-cwd-'));
  const app = join(home, 'app');
  const site = join(home, 'site');
  for (const dir of [app, site]) {
    mkdirSync(dir);
    writeFileSync(join(dir, 'package.json'), '{}');
  }
  return { file: join(home, 'canvas.feega'), home, app, site };
}

const folder = (repo: string) => ({ kind: 'folder', repo, branch: null, sha: null, routes: [] });

describe('where a local agent works', () => {
  it('in the folder that holds the .feega file', () => {
    const { file, home } = project();

    expect(agentCwd(file, [])).toBe(home);
  });

  it('in the codebase folder the canvas imported', () => {
    const { file, app } = project();

    expect(agentCwd(file, [undefined, folder(app), folder(app)])).toBe(app);
  });

  it('back in the file folder when the canvas imported several folders, or one that is gone', () => {
    const { file, home, app, site } = project();

    expect(agentCwd(file, [folder(app), folder(site)])).toBe(home);
    expect(agentCwd(file, [folder(join(home, 'missing'))])).toBe(home);
  });

  it('never in a GitHub repo name or an upload', () => {
    const { file, home } = project();

    expect(agentCwd(file, [{ ...folder('owner/repo'), kind: 'github' }, { ...folder('org/x.zip'), kind: 'upload' }])).toBe(home);
  });
});
