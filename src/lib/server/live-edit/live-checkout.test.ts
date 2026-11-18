import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LIVE_BRANCH, liveCheckoutOf } from './live-checkout';

const made: string[] = [];

const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  made.push(dir);
  return dir;
};

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

function appRepo(): string {
  const repo = temp('live-app-');
  git(repo, 'init', '-q', '-b', 'main');
  writeFileSync(join(repo, 'page.svelte'), '<h1>Hi</h1>\n');
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n.env\n');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t.t', 'commit', '-qm', 'first');
  mkdirSync(join(repo, 'node_modules', 'dep'), { recursive: true });
  writeFileSync(join(repo, 'node_modules', 'dep', 'index.js'), 'export default 1;\n');
  writeFileSync(join(repo, '.env'), 'KEY=1\n');
  return repo;
}

afterEach(() => {
  made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('liveCheckoutOf', () => {
  it('checks the live branch out away from .git, where a dev server refuses to serve files', () => {
    const repo = appRepo();
    const live = liveCheckoutOf(repo, temp('live-home-'));

    expect(live.split(sep)).not.toContain('.git');
    expect(live.startsWith(repo + sep)).toBe(false);
    expect(git(live, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(LIVE_BRANCH);
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it('gives the checkout its own dependencies, so none resolves outside the folder being served', () => {
    const repo = appRepo();
    const live = liveCheckoutOf(repo, temp('live-home-'));

    expect(lstatSync(join(live, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(live, 'node_modules', 'dep', 'index.js'), 'utf8')).toContain('export default 1');
    expect(readFileSync(join(live, '.env'), 'utf8')).toBe('KEY=1\n');
  });

  it('returns the same checkout on the next call', () => {
    const repo = appRepo();
    const home = temp('live-home-');

    expect(liveCheckoutOf(repo, home)).toBe(liveCheckoutOf(repo, home));
  });

  it('serves the folder as it is when it is not a git repository', () => {
    const folder = temp('live-plain-');

    expect(liveCheckoutOf(folder, temp('live-home-'))).toBe(folder);
  });
});
