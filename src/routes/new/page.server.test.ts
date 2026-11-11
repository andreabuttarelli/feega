import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

async function landing(user: { id: string } | null): Promise<string | null> {
  try {
    await load({ url: new URL('https://oh.feega.app/new'), locals: { safeGetSession: async () => ({ session: user ? {} : null, user }) } } as never);
  } catch (e) {
    return (e as { location: string }).location;
  }
  return null;
}

describe('/new: the prompt for who has no account yet', () => {
  it('opens signed out', async () => {
    expect(await landing(null)).toBeNull();
  });

  it('a signed-in user goes to the home prompt', async () => {
    expect(await landing({ id: 'u1' })).toBe('/app');
  });
});

describe('/new: a handoff from the landing', () => {
  it('stays open for a signed-in user so the prompt is not lost', async () => {
    let location: string | null = null;
    try {
      await load({ url: new URL('https://oh.feega.app/new?prompt=x'), locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }) } } as never);
    } catch (e) {
      location = (e as { location: string }).location;
    }
    expect(location).toBeNull();
  });
});
