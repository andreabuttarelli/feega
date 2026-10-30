import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { load } from './+page.server';

async function run(path: string, signedIn = true) {
  try {
    return await (load as (e: unknown) => Promise<unknown>)({ url: new URL(`https://oh.feega.app${path}`), locals: { safeGetSession: async () => ({ user: signedIn ? { id: 'u' } : null }) } });
  } catch (error) {
    if (isRedirect(error)) {
      return { location: error.location };
    }
    throw error;
  }
}

describe('/start', () => {
  it('hands the page the validated url and its host', async () => {
    expect(await run('/start?start_url=https%3A%2F%2Fwww.stripe.com')).toEqual({ url: 'https://www.stripe.com/', host: 'stripe.com' });
  });

  it('signed out, it goes to sign in carrying the url', async () => {
    expect(await run('/start?start_url=https%3A%2F%2Fstripe.com', false)).toEqual({ location: `/login?start_url=${encodeURIComponent('https://stripe.com/')}` });
  });

  it('without a usable url there is nothing to start: home', async () => {
    expect(await run('/start?start_url=javascript%3Aalert(1)')).toEqual({ location: '/app' });
  });
});
