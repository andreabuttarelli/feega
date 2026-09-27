import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

vi.mock('$lib/server/tenancy/entry', async (orig) => ({
	...(await orig<object>()),
	homePathFor: vi.fn(async () => '/p/proj1/c/canvas1')
}));

const { load } = await import('./+page.server');

const ORIGIN = 'https://feega.app';
const SIGNED_IN = { session: { access_token: 'jwt' }, user: { id: 'u1' } };

function run(path: string) {
  const url = new URL(`${ORIGIN}${path}`);
  const event = {
    url,
    cookies: {
      get: () => undefined,
      delete: () => undefined
    },
    locals: { safeGetSession: async () => SIGNED_IN, db: async () => ({ mocked: true }) }
  };

  return Promise.resolve((load as any)(event)).then(
    () => null,
    (error) => {
      if (isRedirect(error)) return { status: error.status, location: error.location };
      throw error;
    }
  );
}

describe('login page load', () => {
  // L'onboarding non esiste più: entrare è un bootstrap silenzioso, e la propria tela è
  // l'unica porta — mai /app, che oggi è solo un redirect permanente.
  it('manda chi è già dentro alla propria tela, qualunque parametro porti', async () => {
    await expect(run('/login?website=acme.example')).resolves.toEqual({
      status: 303,
      location: '/p/proj1/c/canvas1'
    });
  });

  it('non fa eccezione per next=onboarding, che non porta più da nessuna parte', async () => {
    await expect(run('/login?next=onboarding')).resolves.toEqual({
      status: 303,
      location: '/p/proj1/c/canvas1'
    });
  });
});
