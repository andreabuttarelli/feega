import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

const renameOrg = vi.fn(async (_input: { orgId: string; name: string }) => {});
let memberships: { org: { id: string; name: string; slug: string }; role: string }[] = [];

vi.mock('$lib/server/tenancy/rename-org', () => ({ renameOrg: (input: { orgId: string; name: string }) => renameOrg(input) }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => memberships) }));
vi.mock('$lib/server/tenancy/entry', async (orig) => ({
  ...(await orig<object>()),
  enterApp: vi.fn(async () => ({ orgId: 'org1' }))
}));

const { load, actions } = await import('./+page.server');

type Profile = { name: string | null };

function fakeDb(profile: Profile) {
  const updates: Record<string, unknown>[] = [];
  const db = {
    from: (table: string) => {
      if (table !== 'profiles') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
        update: (values: Record<string, unknown>) => ({
          eq: async () => {
            updates.push(values);
            return { error: null };
          }
        })
      };
    }
  };
  return { db, updates };
}

const googleUser = {
  id: 'u1',
  email: 'ada@example.com',
  app_metadata: { provider: 'google' },
  user_metadata: { given_name: 'Ada', family_name: 'Lovelace' }
};

function event(path: string, user: object | null, db: object, form?: Record<string, string>) {
  const url = new URL(`https://oh.feega.app${path}`);
  const body = new FormData();
  Object.entries(form ?? {}).forEach(([key, value]) => body.set(key, value));
  return {
    url,
    request: new Request(url, { method: 'POST', body }),
    cookies: { get: () => undefined },
    locals: { safeGetSession: async () => ({ session: user ? {} : null, user }), db: async () => db }
  } as never;
}

async function redirected(run: () => unknown) {
  try {
    await run();
  } catch (error) {
    if (isRedirect(error)) {
      return { status: error.status, location: error.location };
    }
    throw error;
  }
  return null;
}

beforeEach(() => {
  renameOrg.mockClear();
  memberships = [{ org: { id: 'org1', name: 'ada', slug: 'ada-1' }, role: 'owner' }];
});

describe('onboarding load', () => {
  it('prefills the Google name and a team name', async () => {
    const { db } = fakeDb({ name: null });
    const data = await (load as any)(event('/onboarding?next=/cli/callback', googleUser, db));

    expect(data).toMatchObject({ first: 'Ada', last: 'Lovelace', orgName: "Ada's team", needsName: true, needsOrg: true });
  });

  it('asks a GitHub user for the name even when the handle was stored as one, and prefills nothing', async () => {
    const githubUser = { id: 'u2', email: 'g@example.com', app_metadata: { provider: 'github' }, user_metadata: { user_name: 'ghopper', name: 'ghopper' } };
    memberships = [{ org: { id: 'org1', name: 'Acme', slug: 'acme' }, role: 'owner' }];
    const { db } = fakeDb({ name: 'ghopper' });

    const data = await (load as any)(event('/onboarding', githubUser, db));

    expect(data).toMatchObject({ needsName: true, first: '', last: '' });
  });

  it('sends a finished account straight to where it was going', async () => {
    memberships = [{ org: { id: 'org1', name: 'Acme', slug: 'acme' }, role: 'owner' }];
    const { db } = fakeDb({ name: 'Ada Lovelace' });

    await expect(redirected(() => (load as any)(event('/onboarding?next=/app/settings/profile', googleUser, db)))).resolves.toEqual({
      status: 303,
      location: '/app/settings/profile'
    });
  });

  it('sends a signed-out visitor to login', async () => {
    await expect(redirected(() => (load as any)(event('/onboarding', null, {})))).resolves.toEqual({ status: 303, location: '/login' });
  });
});

describe('onboarding save action', () => {
  const save = (form: Record<string, string>, path = '/onboarding?next=/cli/callback%3Fcli_port%3D1%26cli_state%3Dx') =>
    (actions.save as any)(event(path, googleUser, fakeDb({ name: null }).db, form));

  it('writes the full name and the org name, then continues to the CLI callback', async () => {
    const { db, updates } = fakeDb({ name: null });
    const result = await redirected(() =>
      (actions.save as any)(
        event('/onboarding?next=/cli/callback%3Fcli_port%3D1%26cli_state%3Dx', googleUser, db, { first: ' Ada ', last: 'Lovelace', orgName: ' Analytical ' })
      )
    );

    expect(updates[0]).toMatchObject({ name: 'Ada Lovelace' });
    expect(renameOrg).toHaveBeenCalledWith({ orgId: 'org1', name: 'Analytical' });
    expect(result).toEqual({ status: 303, location: '/cli/callback?cli_port=1&cli_state=x' });
  });

  it('refuses an empty last name', async () => {
    const result = await save({ first: 'Ada', last: '', orgName: 'Analytical' });

    expect(result).toMatchObject({ status: 400, data: { error: 'name_required' } });
    expect(renameOrg).not.toHaveBeenCalled();
  });

  it('refuses an empty org name', async () => {
    const result = await save({ first: 'Ada', last: 'Lovelace', orgName: '  ' });

    expect(result).toMatchObject({ status: 400, data: { error: 'org_required' } });
  });

  it('refuses the auto-created org name, which would show onboarding again', async () => {
    const result = await save({ first: 'Ada', last: 'Lovelace', orgName: 'ada' });

    expect(result).toMatchObject({ status: 400, data: { error: 'org_name_default' } });
  });

  it('never redirects off site', async () => {
    const result = await redirected(() =>
      (actions.save as any)(event('/onboarding?next=//evil.example', googleUser, fakeDb({ name: null }).db, { first: 'Ada', last: 'Lovelace', orgName: 'Analytical' }))
    );

    expect(result).toEqual({ status: 303, location: '/app' });
  });

  it('does not rename an org the user does not own', async () => {
    memberships = [{ org: { id: 'org1', name: 'ada', slug: 'ada-1' }, role: 'member' }];
    await redirected(() =>
      (actions.save as any)(event('/onboarding', googleUser, fakeDb({ name: null }).db, { first: 'Ada', last: 'Lovelace', orgName: 'Analytical' }))
    );

    expect(renameOrg).not.toHaveBeenCalled();
  });
});
