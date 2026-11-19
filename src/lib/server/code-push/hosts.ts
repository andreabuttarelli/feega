import type { GithubCall } from '$lib/server/code-import/github';
import { repoOf } from '$lib/server/code-import/repo';
import { git } from './git-cli';
import type { GitHost } from './git-host';
import { githubHost } from './github-host';
import { CodeSourceKind } from './link';
import { localGitHost, Publish } from './local-git-host';

const ORIGIN_URL = /github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/;

export type HostSources = {
  connected: () => Promise<GithubCall | null>;
  folder: (raw: string) => string | null;
};

const githubCall = (sources: HostSources): Promise<GithubCall | null> => sources.connected().catch(() => null);

async function originRepo(dir: string) {
  const url = (await git(dir, ['remote', 'get-url', 'origin'])).out.trim();
  const m = url.match(ORIGIN_URL);
  return { hasOrigin: url !== '', github: m ? repoOf(`https://github.com/${m[1]}/${m[2]}`) : null };
}

type HostOf = (sources: HostSources, repo: string) => Promise<GitHost | null>;

export enum PullCap {
  Ready = 'ready',
  Connect = 'connect',
  None = 'none'
}

export type HostCaps = { git: boolean; wip: boolean; publish: boolean; pulls: PullCap };

const NO_GIT: HostCaps = { git: false, wip: false, publish: false, pulls: PullCap.None };

const isRepo = async (dir: string) => (await git(dir, ['rev-parse', '--is-inside-work-tree'])).out.trim() === 'true';

const pullCapOf = async (sources: HostSources) => ((await githubCall(sources)) ? PullCap.Ready : PullCap.Connect);

type CapsOf = (sources: HostSources, repo: string) => Promise<HostCaps>;

const CAPS: Record<CodeSourceKind, CapsOf> = {
  [CodeSourceKind.Github]: async (sources) => ({ git: true, wip: true, publish: true, pulls: await pullCapOf(sources) }),
  [CodeSourceKind.Folder]: async (sources, raw) => {
    const dir = sources.folder(raw);
    if (!dir || !(await isRepo(dir))) {
      return NO_GIT;
    }
    const origin = await originRepo(dir);
    return { git: true, wip: false, publish: origin.hasOrigin, pulls: origin.github ? await pullCapOf(sources) : PullCap.None };
  }
};

export const capsOf = (sources: HostSources) => (source: CodeSourceKind, repo: string) => CAPS[source](sources, repo);

const HOSTS: Record<CodeSourceKind, HostOf> = {
  [CodeSourceKind.Github]: async (sources, repoName) => {
    const repo = repoOf(`https://github.com/${repoName}`);
    const call = repo ? await githubCall(sources) : null;
    return repo && call ? githubHost(call, repo) : null;
  },
  [CodeSourceKind.Folder]: async (sources, raw) => {
    const dir = sources.folder(raw);
    if (!dir) {
      return null;
    }
    const origin = await originRepo(dir);
    const call = origin.github ? await githubCall(sources) : null;
    const pulls = origin.github && call ? githubHost(call, origin.github) : null;
    return localGitHost(dir, { publish: origin.hasOrigin ? Publish.Origin : Publish.Local, pulls });
  }
};

export const hostOf = (sources: HostSources) => (source: CodeSourceKind, repo: string) => HOSTS[source](sources, repo);
