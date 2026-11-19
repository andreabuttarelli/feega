import { openSecret, sealSecret } from '$lib/server/secrets/seal';
import { LinkStatus, ownerOf, type AccountLinks, type ProviderCaller, type Toolkit } from './account-links';
import type { AccountStore } from './account-store';
import { CONNECT_CALLBACK, handleOf, TOOLKITS } from './toolkits';

const STATE_CONTEXT = 'feega:connect-state';
const STATE_TTL_MS = 15 * 60_000;

export type Scope = { orgId: string; userId: string };

export type ConnectState = Scope & { toolkit: Toolkit; returnTo: string };

export type AccountStatus = { configured: boolean; connected: boolean; label: string | null };

export type AccountAccess = {
  status: () => Promise<AccountStatus>;
  connect: (origin: string, returnTo: string) => Promise<{ url: string } | null>;
  confirm: (accountId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  call: () => Promise<ProviderCaller | null>;
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

export function accountAccess(links: AccountLinks | null, store: AccountStore, scope: Scope, toolkit: Toolkit): AccountAccess {
  const owner = ownerOf(scope.orgId, scope.userId);

  const active = async () => {
    const account = links ? await store.read(toolkit) : null;
    return account?.status === LinkStatus.Active ? account : null;
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
      const state = sealConnectState({ ...scope, toolkit, returnTo });
      const started = await links.link(owner, toolkit, `${origin}${CONNECT_CALLBACK}?state=${encodeURIComponent(state)}`);
      await store.save(toolkit, { accountId: started.accountId, status: LinkStatus.Pending, label: null });
      return { url: started.url };
    },
    confirm: async (accountId) => {
      const stored = links ? await store.read(toolkit) : null;
      if (!links || stored?.accountId !== accountId || (await links.status(accountId)) !== LinkStatus.Active) {
        return false;
      }
      const me = await links.call(owner, accountId, TOOLKITS[toolkit].identity);
      await store.save(toolkit, { accountId, status: LinkStatus.Active, label: handleOf(toolkit, me.data) });
      return true;
    },
    disconnect: async () => {
      const stored = links ? await store.read(toolkit) : null;
      if (links && stored) {
        await links.forget(stored.accountId).catch(() => undefined);
      }
      await store.remove(toolkit);
    },
    call: async () => {
      const account = await active();
      return links && account ? (request) => links.call(owner, account.accountId, request) : null;
    }
  };
}
