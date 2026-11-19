import { describe, expect, it, vi } from 'vitest';
import { LinkStatus, Toolkit, type AccountLinks, type ProviderAnswer, type ProviderCall } from './account-links';
import type { AccountStore, StoredAccount } from './account-store';
import { accountAccess, openConnectState } from './account-access';
import { CONNECT_CALLBACK } from './toolkits';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-accounts' } }));

const SCOPE = { orgId: 'o1', userId: 'u1' };

function memoryStore(start: StoredAccount | null = null): AccountStore & { saved: () => StoredAccount | null } {
  let row = start;
  return {
    read: async () => row,
    save: async (_t, account) => {
      row = account;
      return true;
    },
    remove: async () => {
      row = null;
    },
    saved: () => row
  };
}

function linksOf(answers: Record<string, ProviderAnswer> = {}) {
  return {
    link: vi.fn(async (_owner: string, _toolkit: Toolkit, _callback: string) => ({ url: 'https://connect.composio.dev/link/f', accountId: 'ca_f' })),
    status: vi.fn(async () => LinkStatus.Active),
    call: vi.fn(async (_owner: string, _id: string, request: ProviderCall) => answers[request.endpoint] ?? { status: 404, data: null, headers: {}, file: null }),
    forget: vi.fn(async () => undefined)
  } satisfies AccountLinks;
}

const ok = (data: unknown): ProviderAnswer => ({ status: 200, data, headers: {}, file: null });

describe('accountAccess', () => {
  it('collegare Figma porta al Connect Link col toolkit nello stato e il ritorno sul callback comune', async () => {
    const links = linksOf();
    const started = await accountAccess(links, memoryStore(), SCOPE, Toolkit.Figma).connect('https://feega.app', '/settings');

    expect(started).toEqual({ url: 'https://connect.composio.dev/link/f' });
    const callback = new URL(links.link.mock.calls[0][2]);
    expect(callback.pathname).toBe(CONNECT_CALLBACK);
    expect(links.link.mock.calls[0][1]).toBe(Toolkit.Figma);
    expect(openConnectState(callback.searchParams.get('state')!)).toMatchObject({ toolkit: Toolkit.Figma, orgId: 'o1', userId: 'u1', returnTo: '/settings' });
  });

  it('la conferma legge l’identità dalla riga del toolkit', async () => {
    const store = memoryStore({ accountId: 'ca_f', status: LinkStatus.Pending, label: null });
    const access = accountAccess(linksOf({ 'https://api.figma.com/v1/me': ok({ handle: 'ada' }) }), store, SCOPE, Toolkit.Figma);

    expect(await access.confirm('ca_f')).toBe(true);
    expect(await access.status()).toEqual({ configured: true, connected: true, label: 'ada' });
  });

  it('senza conto attivo non c’è chiamata, e scollegare dimentica il conto su Composio', async () => {
    const links = linksOf();
    const store = memoryStore({ accountId: 'ca_d', status: LinkStatus.Pending, label: null });
    const access = accountAccess(links, store, SCOPE, Toolkit.Dropbox);

    expect(await access.call()).toBeNull();
    await access.disconnect();
    expect(links.forget).toHaveBeenCalledWith('ca_d');
    expect(store.saved()).toBeNull();
  });
});
