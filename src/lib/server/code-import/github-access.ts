import { openSecret, sealSecret } from '$lib/server/secrets/seal';
import { LinkStatus, ownerOf, Toolkit, type AccountLinks } from '$lib/server/connections/account-links';
import type { AccountStore } from '$lib/server/connections/account-store';
import { archiveOf, branchesOf, reposOf, visibilityOf, Visibility, type GithubCall, type GithubRepo } from './github';
import type { RepoRef } from './repo';

export const GITHUB_CALLBACK = '/api/v1/github/callback';

const STATE_CONTEXT = 'feega:connect-state';
const STATE_TTL_MS = 15 * 60_000;

export type ConnectState = { orgId: string; userId: string; returnTo: string };

export type GithubStatus = { configured: boolean; connected: boolean; label: string | null };

export type GithubAccess = {
  status: () => Promise<GithubStatus>;
  connect: (origin: string, returnTo: string) => Promise<{ url: string } | null>;
  confirm: (accountId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  repos: () => Promise<GithubRepo[] | null>;
  branches: (repo: RepoRef) => Promise<string[] | null>;
  archive: (repo: RepoRef) => Promise<Uint8Array | null>;
};

export function sealConnectState(state: ConnectState, now = Date.now()): string {
  return sealSecret(STATE_CONTEXT, JSON.stringify({ ...state, exp: now + STATE_TTL_MS }));
}

export function openConnectState(sealed: string, now = Date.now()): ConnectState | null {
  const text = openSecret(STATE_CONTEXT, sealed);
  if (!text) {
    return null;
  }
  const { exp, ...state } = JSON.parse(text) as ConnectState & { exp: number };
  return exp > now ? state : null;
}

type Scope = { orgId: string; userId: string };

export function githubAccess(links: AccountLinks | null, store: AccountStore, scope: Scope, fetchFn: typeof fetch = fetch): GithubAccess {
  const owner = ownerOf(scope.orgId, scope.userId);

  const active = async () => {
    const account = links ? await store.read(Toolkit.GitHub) : null;
    return account?.status === LinkStatus.Active ? account : null;
  };

  const caller = async (): Promise<GithubCall | null> => {
    const account = await active();
    return links && account ? (request) => links.call(owner, account.accountId, request) : null;
  };

  return {
    status: async () => {
      const account = await active();
      return { configured: links !== null, connected: account !== null, label: account?.label ?? null };
    },
    connect: async (origin, returnTo) => {
      if (!links) {
        return null;
      }
      const state = sealConnectState({ orgId: scope.orgId, userId: scope.userId, returnTo });
      const started = await links.link(owner, Toolkit.GitHub, `${origin}${GITHUB_CALLBACK}?state=${encodeURIComponent(state)}`);
      await store.save(Toolkit.GitHub, { accountId: started.accountId, status: LinkStatus.Pending, label: null });
      return { url: started.url };
    },
    confirm: async (accountId) => {
      const stored = links ? await store.read(Toolkit.GitHub) : null;
      if (!links || stored?.accountId !== accountId || (await links.status(accountId)) !== LinkStatus.Active) {
        return false;
      }
      const me = await links.call(owner, accountId, { endpoint: '/user' });
      const label = me.data && typeof me.data === 'object' ? String((me.data as { login?: string }).login ?? '') || null : null;
      await store.save(Toolkit.GitHub, { accountId, status: LinkStatus.Active, label });
      return true;
    },
    disconnect: async () => {
      const stored = links ? await store.read(Toolkit.GitHub) : null;
      if (links && stored) {
        await links.forget(stored.accountId).catch(() => undefined);
      }
      await store.remove(Toolkit.GitHub);
    },
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
    }
  };
}
