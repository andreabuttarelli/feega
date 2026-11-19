import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Toolkit } from '$lib/server/connections/account-links';

const connect = vi.fn();
const disconnect = vi.fn();
const status = vi.fn();
const accountFor = vi.fn((_db: unknown, _scope: unknown, toolkit: Toolkit) => ({ connect: (...a: unknown[]) => connect(toolkit, ...a), disconnect: () => disconnect(toolkit), status: () => status(toolkit) }));
vi.mock('$lib/server/connections/runtime', () => ({ accountFor: (...args: [unknown, unknown, Toolkit]) => accountFor(...args) }));

const { connectAccount, connections, disconnectAccount } = await import('./connection-actions');

const parent = async () => ({ org: { id: 'o1' } });
const locals = (user: { id: string } | null = { id: 'u1' }) => ({ supabase: {}, safeGetSession: async () => ({ user }) });
const post = (toolkit: string, user?: { id: string } | null) => {
  const form = new FormData();
  form.set('toolkit', toolkit);
  form.set('returnTo', '/app/settings/profile');
  return { request: new Request('https://feega.app/api/v1/me/settings/profile', { method: 'POST', body: form }), url: new URL('https://feega.app/api/v1/me/settings/profile'), locals: locals(user), parent } as never;
};

beforeEach(() => {
  connect.mockReset();
  disconnect.mockReset();
  status.mockReset().mockResolvedValue({ configured: true, connected: false, label: null });
});

describe('one Connections list in settings', () => {
  it('lists every toolkit with its label and state', async () => {
    status.mockImplementation(async (t: Toolkit) => ({ configured: true, connected: t === Toolkit.Figma, label: t === Toolkit.Figma ? 'ada' : null }));

    const list = await connections({ locals: locals(), parent } as never);

    expect(list.map((c) => c.toolkit)).toEqual(Object.values(Toolkit));
    expect(list.find((c) => c.toolkit === Toolkit.Figma)).toEqual({ toolkit: Toolkit.Figma, label: 'Figma', configured: true, connected: true, handle: 'ada' });
    expect(accountFor).toHaveBeenCalledWith({}, { orgId: 'o1', userId: 'u1' }, Toolkit.OneDrive);
  });

  it('connecting sends the person to the Composio link and back to the page', async () => {
    connect.mockResolvedValue({ url: 'https://connect.composio.dev/x' });

    await expect(connectAccount(post('one_drive'))).rejects.toMatchObject({ status: 303, location: 'https://connect.composio.dev/x' });
    expect(connect).toHaveBeenCalledWith(Toolkit.OneDrive, 'https://feega.app', '/app/settings/profile');
  });

  it('without Composio connecting says so', async () => {
    connect.mockResolvedValue(null);

    expect(await connectAccount(post('figma'))).toMatchObject({ status: 501, data: { connectionError: 'not_configured' } });
  });

  it('disconnects the toolkit of the form, and refuses one we do not know', async () => {
    expect(await disconnectAccount(post('dropbox'))).toEqual({ disconnected: Toolkit.Dropbox });
    expect(disconnect).toHaveBeenCalledWith(Toolkit.Dropbox);
    expect(await disconnectAccount(post('box'))).toMatchObject({ status: 400, data: { connectionError: 'invalid' } });
  });

  it('refuses without a session', async () => {
    expect(await disconnectAccount(post('dropbox', null))).toMatchObject({ status: 401 });
  });
});
