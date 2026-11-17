import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type GitRun = { code: number; out: string; err: string };

const NO_PROMPT = { GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo', LC_ALL: 'C' };

export function git(dir: string, args: string[], opts: { input?: string; env?: Record<string, string> } = {}): Promise<GitRun> {
  return new Promise((resolve) => {
    const child = spawn('git', ['-C', dir, ...args], { env: { ...process.env, ...NO_PROMPT, ...opts.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => resolve({ code: -1, out, err: String(e) }));
    child.on('close', (code) => resolve({ code: code ?? -1, out, err }));
    child.stdin.end(opts.input ?? '');
  });
}

const FILE_MODE = '100644';
const NULL_SHA = '0'.repeat(40);

export type TreeEdit = { path: string; content: string | null };

export async function commitTree(dir: string, edits: TreeEdit[], parents: string[], message: string): Promise<GitRun> {
  const scratch = await mkdtemp(join(tmpdir(), 'feega-index-'));
  const env = { GIT_INDEX_FILE: join(scratch, 'index') };
  try {
    const base = await git(dir, parents[0] ? ['read-tree', parents[0]] : ['read-tree', '--empty'], { env });
    if (base.code) {
      return base;
    }
    for (const edit of edits) {
      const step = edit.content === null ? await git(dir, ['update-index', '--index-info'], { env, input: `0 ${NULL_SHA}\t${edit.path}\n` }) : await addBlob(dir, edit.path, edit.content, env);
      if (step.code) {
        return step;
      }
    }
    const tree = await git(dir, ['write-tree'], { env });
    if (tree.code) {
      return tree;
    }
    return git(dir, ['commit-tree', tree.out.trim(), ...parents.flatMap((p) => ['-p', p]), '-m', message], { env: await identity(dir) });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function addBlob(dir: string, path: string, content: string, env: Record<string, string>): Promise<GitRun> {
  const blob = await git(dir, ['hash-object', '-w', '--stdin'], { input: content });
  return blob.code ? blob : git(dir, ['update-index', '--add', '--cacheinfo', `${FILE_MODE},${blob.out.trim()},${path}`], { env });
}

const FALLBACK_NAME = 'Feega';
const FALLBACK_EMAIL = 'noreply@feega.app';

async function identity(dir: string): Promise<Record<string, string>> {
  const configured = (await git(dir, ['config', 'user.email'])).out.trim();
  return configured ? {} : { GIT_AUTHOR_NAME: FALLBACK_NAME, GIT_AUTHOR_EMAIL: FALLBACK_EMAIL, GIT_COMMITTER_NAME: FALLBACK_NAME, GIT_COMMITTER_EMAIL: FALLBACK_EMAIL };
}
