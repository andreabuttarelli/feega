import { describe, expect, it, vi } from 'vitest';

const toolScope = vi.fn(async () => ({ db: {}, orgId: 'org-a', projectId: 'p1', userId: 'u1' }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope }));

const { load } = await import('./+page.server');

describe('/app/api-keys', () => {
  it('sends the user to the api keys of their current project, where keys carry org and scopes', async () => {
    const thrown = await Promise.resolve(load({} as never)).catch((e: unknown) => e);

    expect(thrown).toMatchObject({ status: 303, location: '/p/p1/settings/api-keys' });
  });
});
