import { describe, expect, it, vi, beforeEach } from 'vitest';

const disconnectCloud = vi.fn();
const cloudStatuses = vi.fn();
vi.mock('$lib/server/cloud/runtime', () => ({ disconnectCloud: (...args: unknown[]) => disconnectCloud(...args), cloudStatuses: (...args: unknown[]) => cloudStatuses(...args) }));

const { cloudConnections, disconnectCloudAction } = await import('./cloud-actions');

const locals = (user: { id: string } | null = { id: 'u1' }) => ({ supabase: {}, safeGetSession: async () => ({ user }) });
const post = (provider: string, user?: { id: string } | null) => {
  const form = new FormData();
  form.set('provider', provider);
  return { request: new Request('https://feega.app', { method: 'POST', body: form }), locals: locals(user) } as never;
};

beforeEach(() => {
  disconnectCloud.mockReset().mockResolvedValue({ revoked: true });
  cloudStatuses.mockReset();
});

describe('Drive and Dropbox in settings', () => {
  it('disconnects the provider of the form', async () => {
    const out = await disconnectCloudAction(post('dropbox'));

    expect(disconnectCloud).toHaveBeenCalledWith({}, 'u1', 'dropbox');
    expect(out).toEqual({ cloudDisconnected: 'dropbox' });
  });

  it('refuses a provider we do not know', async () => {
    expect(await disconnectCloudAction(post('box'))).toMatchObject({ status: 400, data: { cloudError: 'invalid' } });
    expect(disconnectCloud).not.toHaveBeenCalled();
  });

  it('refuses a signed-out request', async () => {
    expect(await disconnectCloudAction(post('dropbox', null))).toMatchObject({ status: 401 });
  });

  it('lists the connections for the page, and none when signed out', async () => {
    cloudStatuses.mockResolvedValue([{ provider: 'dropbox', connected: true }]);

    expect(await cloudConnections(locals())).toEqual([{ provider: 'dropbox', connected: true }]);
    expect(await cloudConnections(locals(null))).toEqual([]);
  });
});
