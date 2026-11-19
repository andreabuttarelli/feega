import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { git } from '$lib/server/code-push/git-cli';

const CANVAS_DIR = '.feega';
const ORIGIN = 'origin';
const GITHUB_ORIGIN = /github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/;

export type ProjectOrigin = { github: string | null };

export type ProjectGit = { git: false } | { git: true; branch: string | null; changes: number; ahead: number; origin: ProjectOrigin | null };

export class ProjectGitError extends Error {}

export const projectDirOf = async (path: string) => ((await stat(path)).isDirectory() ? path : dirname(path));

async function run(dir: string, args: string[]) {
  const done = await git(dir, args);
  if (done.code) {
    throw new ProjectGitError(done.err.trim() || `git ${args[0]} failed`);
  }
  return done.out.trim();
}

const out = async (dir: string, args: string[]) => (await git(dir, args)).out.trim();

async function originOf(dir: string): Promise<ProjectOrigin | null> {
  const url = await out(dir, ['remote', 'get-url', ORIGIN]);
  if (!url) {
    return null;
  }
  const m = url.match(GITHUB_ORIGIN);
  return { github: m ? `${m[1]}/${m[2]}` : null };
}

async function aheadOf(dir: string, origin: ProjectOrigin | null) {
  if (!origin) {
    return 0;
  }
  const upstream = await git(dir, ['rev-list', '--count', '@{upstream}..HEAD']);
  if (!upstream.code) {
    return Number(upstream.out.trim());
  }
  return Number(await out(dir, ['rev-list', '--count', 'HEAD', '--not', '--remotes'])) || 0;
}

export async function projectGit(dir: string): Promise<ProjectGit> {
  if ((await out(dir, ['rev-parse', '--is-inside-work-tree'])) !== 'true') {
    return { git: false };
  }

  const origin = await originOf(dir);
  const changes = (await out(dir, ['status', '--porcelain', '--untracked-files=all', '--', CANVAS_DIR])).split('\n').filter(Boolean).length;
  return {
    git: true,
    branch: (await out(dir, ['branch', '--show-current'])) || null,
    changes,
    ahead: await aheadOf(dir, origin),
    origin
  };
}

export async function commitProject(dir: string, message: string) {
  await run(dir, ['add', '-A', '--', CANVAS_DIR]);
  await run(dir, ['commit', '-q', '-m', message, '--', CANVAS_DIR]);
}

export async function pushProject(dir: string) {
  await run(dir, ['push', '-q', '-u', ORIGIN, 'HEAD']);
}

export async function defaultBranchOf(dir: string) {
  const head = await out(dir, ['symbolic-ref', '--short', `refs/remotes/${ORIGIN}/HEAD`]);
  return head ? head.slice(ORIGIN.length + 1) : 'main';
}

export const compareUrl = (repo: string, base: string, branch: string) => `https://github.com/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch)}?expand=1`;
