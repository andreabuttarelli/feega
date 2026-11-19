import { Toolkit, type AccountLinks } from '$lib/server/connections/account-links';
import type { AccountStore } from '$lib/server/connections/account-store';
import { accountAccess, type AccountAccess, type Scope } from '$lib/server/connections/account-access';
import { archiveOf, branchesOf, reposOf, visibilityOf, Visibility, type GithubCall, type GithubRepo } from './github';
import type { RepoRef } from './repo';

export type GithubStatus = Awaited<ReturnType<AccountAccess['status']>>;

export type GithubAccess = {
  status: () => Promise<GithubStatus>;
  connect: (origin: string, returnTo: string) => Promise<{ url: string } | null>;
  confirm: (accountId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  repos: () => Promise<GithubRepo[] | null>;
  branches: (repo: RepoRef) => Promise<string[] | null>;
  archive: (repo: RepoRef) => Promise<Uint8Array | null>;
  call: () => Promise<GithubCall | null>;
};

export function githubAccess(links: AccountLinks | null, store: AccountStore, scope: Scope, fetchFn: typeof fetch = fetch): GithubAccess {
  const account = accountAccess(links, store, scope, Toolkit.GitHub);
  const caller = account.call;

  return {
    status: account.status,
    connect: account.connect,
    confirm: account.confirm,
    disconnect: account.disconnect,
    repos: async () => {
      const call = await caller();
      return call ? reposOf(call) : null;
    },
    branches: async (repo) => {
      const call = await caller();
      return call ? branchesOf(call, repo) : null;
    },
    archive: async (repo) => {
      const call = await caller();
      if (!call || (await visibilityOf(call, repo)) !== Visibility.Private) {
        return null;
      }
      return archiveOf(call, repo, fetchFn);
    },
    call: caller
  };
}
