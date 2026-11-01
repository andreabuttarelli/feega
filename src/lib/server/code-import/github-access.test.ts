import { describe, expect, it, vi } from 'vitest';
import { LinkStatus, Toolkit, type AccountLinks, type ProviderAnswer, type ProviderCall } from '$lib/server/connections/account-links';
import type { AccountStore, StoredAccount } from '$lib/server/connections/account-store';
import { githubAccess, openConnectState } from './github-access';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-github' } }));

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

function linksOf(answers: Record<string, ProviderAnswer> = {}, status = LinkStatus.Active) {
  return {
    link: vi.fn(async (_owner: string, _toolkit: Toolkit, _callback: string) => ({ url: 'https://connect.composio.dev/link/abc', accountId: 'ca_1' })),
    status: vi.fn(async () => status),
    call: vi.fn(async (_owner: string, _id: string, request: ProviderCall) => answers[request.endpoint] ?? { status: 404, data: null, headers: {}, file: null }),
    forget: vi.fn(async () => undefined)
  } satisfies AccountLinks;
}

const ok = (data: unknown): ProviderAnswer => ({ status: 200, data, headers: {}, file: null });

describe('githubAccess', () => {
  it('senza Composio configurato lo dice, e non apre nessun collegamento', async () => {
    const access = githubAccess(null, memoryStore(), SCOPE);

    expect(await access.status()).toEqual({ configured: false, connected: false, label: null });
    expect(await access.connect('https://feega.app', '/p/x')).toBeNull();
  });

  it('collegare salva il conto in attesa e porta al Connect Link con lo stato firmato', async () => {
    const store = memoryStore();
    const links = linksOf();
    const access = githubAccess(links, store, SCOPE);

    const started = await access.connect('https://feega.app', '/p/x');

    expect(started).toEqual({ url: 'https://connect.composio.dev/link/abc' });
    expect(store.saved()).toEqual({ accountId: 'ca_1', status: LinkStatus.Pending, label: null });
    const callback = links.link.mock.calls[0][2];
    expect(links.link.mock.calls[0].slice(0, 2)).toEqual(['o1:u1', Toolkit.GitHub]);
    expect(openConnectState(new URL(callback).searchParams.get('state')!)).toMatchObject({ orgId: 'o1', userId: 'u1', returnTo: '/p/x' });
  });

  it('la conferma attiva solo il conto in attesa, e ne legge il login', async () => {
    const store = memoryStore({ accountId: 'ca_1', status: LinkStatus.Pending, label: null });
    const access = githubAccess(linksOf({ '/user': ok({ login: 'octo' }) }), store, SCOPE);

    expect(await access.confirm('ca_other')).toBe(false);
    expect(await access.confirm('ca_1')).toBe(true);
    expect(store.saved()).toEqual({ accountId: 'ca_1', status: LinkStatus.Active, label: 'octo' });
    expect(await access.status()).toEqual({ configured: true, connected: true, label: 'octo' });
  });

  it('un conto non ancora attivo non si conferma', async () => {
    const store = memoryStore({ accountId: 'ca_1', status: LinkStatus.Pending, label: null });

    expect(await githubAccess(linksOf({}, LinkStatus.Pending), store, SCOPE).confirm('ca_1')).toBe(false);
  });

  it('un repo privato arriva come archivio, uno pubblico no', async () => {
    const store = memoryStore({ accountId: 'ca_1', status: LinkStatus.Active, label: 'octo' });
    const links = linksOf({ '/repos/acme/app': ok({ private: true }), '/repos/acme/app/tarball': { status: 200, data: null, headers: {}, file: 'https://files/t.tgz' }, '/repos/acme/site': ok({ private: false }) });
    const fetchFn = vi.fn(async () => new Response(new Uint8Array([1, 2])));
    const access = githubAccess(links, store, SCOPE, fetchFn as unknown as typeof fetch);

    expect(await access.archive({ owner: 'acme', repo: 'app', ref: null })).toEqual(new Uint8Array([1, 2]));
    expect(await access.archive({ owner: 'acme', repo: 'site', ref: null })).toBeNull();
  });

  it('scollegare dimentica il conto da Composio e dalla tabella', async () => {
    const store = memoryStore({ accountId: 'ca_1', status: LinkStatus.Active, label: 'octo' });
    const links = linksOf();

    await githubAccess(links, store, SCOPE).disconnect();

    expect(links.forget).toHaveBeenCalledWith('ca_1');
    expect(store.saved()).toBeNull();
  });
});
