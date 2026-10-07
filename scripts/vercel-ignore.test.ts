import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/vercel-ignore.sh');
const BUILD = 1;
const SKIP = 0;

function repoTouching(path: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
  git('init', '-q');
  writeFileSync(join(dir, 'README'), 'a');
  git('add', '.');
  git('commit', '-qm', 'first');
  mkdirSync(join(dir, path.split('/')[0]), { recursive: true });
  writeFileSync(join(dir, path), 'b');
  git('add', '.');
  git('commit', '-qm', 'second');
  return dir;
}

function exitOf(env: Record<string, string>, args: string[] = [], cwd = process.cwd()): number | null {
  return spawnSync('bash', [SCRIPT, ...args], { cwd, env: { PATH: process.env.PATH ?? '', ...env } }).status;
}

describe('vercel ignoreCommand: exit 0 skips the build, exit 1 runs it', () => {
  it('builds production', () => {
    expect(exitOf({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_MESSAGE: 'Fix x' })).toBe(BUILD);
  });

  it('skips a preview by default', () => {
    expect(exitOf({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_MESSAGE: 'Fix x' })).toBe(SKIP);
  });

  it('builds a preview whose last commit opts in with [preview]', () => {
    expect(exitOf({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_MESSAGE: 'Fix x [preview]' })).toBe(BUILD);
  });

  it('skips production when the watched path did not change', () => {
    const repo = repoTouching('src/app.ts');
    expect(exitOf({ VERCEL_ENV: 'production' }, ['cli'], repo)).toBe(SKIP);
  });

  it('builds production when the watched path changed', () => {
    const repo = repoTouching('cli/tool.ts');
    expect(exitOf({ VERCEL_ENV: 'production' }, ['cli'], repo)).toBe(BUILD);
  });

  it('is the ignoreCommand of both Vercel projects', () => {
    const app = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const mcp = JSON.parse(readFileSync('cli/mcp/vercel.json', 'utf8'));
    expect(app.ignoreCommand).toBe('bash scripts/vercel-ignore.sh');
    expect(mcp.ignoreCommand).toBe('bash ../../scripts/vercel-ignore.sh ..');
  });
});
