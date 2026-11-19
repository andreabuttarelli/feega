import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { repoOf } from '$lib/server/code-import/repo';
import { GITHUB_API, tokenCall } from '$lib/server/code-push/hosts';
import { githubHost } from '$lib/server/code-push/github-host';
import { LOCAL_FILE_ENV, localStore } from '$lib/server/local/local-mode';
import { commitProject, compareUrl, defaultBranchOf, projectDirOf, projectGit, ProjectGitError, pushProject } from '$lib/server/local/project-git';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const CONFLICT = 409;
const DEFAULT_MESSAGE = 'Update canvas';

const ask = z.discriminatedUnion('action', [z.object({ action: z.literal('commit'), message: z.string().trim().min(1).optional() }), z.object({ action: z.literal('push') }), z.object({ action: z.literal('pull') })]);

async function openedDir() {
  const store = localStore();
  const path = process.env[LOCAL_FILE_ENV];
  if (!store || !path) {
    error(NOT_FOUND);
  }
  return { store, dir: await projectDirOf(path) };
}

async function pullUrl(dir: string) {
  const status = await projectGit(dir);
  const repo = status.git ? status.origin?.github : null;
  const branch = status.git ? status.branch : null;
  if (!repo || !branch) {
    throw new ProjectGitError('A pull request needs a branch and an origin on GitHub.');
  }

  await pushProject(dir);
  const base = await defaultBranchOf(dir);
  const token = process.env.GITHUB_PUSH_TOKEN;
  const ref = repoOf(`https://github.com/${repo}`);
  if (!token || !ref) {
    return compareUrl(repo, base, branch);
  }
  const pull = await githubHost(tokenCall(token, process.env.GITHUB_API_URL || GITHUB_API), ref).upsertPull({ branch, base, title: `Canvas changes on ${branch}`, body: '' });
  return pull.url;
}

export const GET = async () => json(await projectGit((await openedDir()).dir));

export const POST = async ({ request }: { request: Request }) => {
  const { store, dir } = await openedDir();
  const parsed = ask.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    error(BAD_REQUEST, 'action must be commit, push or pull');
  }

  try {
    await store.flush();
    if (parsed.data.action === 'commit') {
      await commitProject(dir, parsed.data.message ?? DEFAULT_MESSAGE);
    }
    if (parsed.data.action === 'push') {
      await pushProject(dir);
    }
    const url = parsed.data.action === 'pull' ? await pullUrl(dir) : null;
    return json({ ...(await projectGit(dir)), url });
  } catch (e) {
    if (e instanceof ProjectGitError) {
      return json({ message: e.message }, { status: CONFLICT });
    }
    throw e;
  }
};
