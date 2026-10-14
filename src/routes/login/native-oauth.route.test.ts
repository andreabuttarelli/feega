import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

vi.mock('$lib/server/oauth', () => ({ takeOAuthReturn: () => null }));

const login = await import('./+page.server');

const DESKTOP_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const NATIVE_SHELL = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) FeegaNative/0.1.0';

async function redirectToFor(userAgent: string, form: Record<string, string> = {}): Promise<string> {
  const body = new FormData();
  for (const [k, v] of Object.entries(form)) {
    body.set(k, v);
  }
  let redirectTo = '';
  const event = {
    url: new URL('https://oh.feega.app/login'),
    request: new Request('https://oh.feega.app/login', { method: 'POST', body, headers: { 'user-agent': userAgent } }),
    locals: {
      supabase: {
        auth: {
          signInWithOAuth: async (o: { options: { redirectTo: string } }) => {
            redirectTo = o.options.redirectTo;
            return { data: { url: 'https://accounts.google.com/o/oauth2' }, error: null };
          }
        }
      }
    }
  };

  try {
    await (login.actions.google as unknown as (e: unknown) => Promise<unknown>)(event);
  } catch (error) {
    if (!isRedirect(error)) {
      throw error;
    }
  }
  return redirectTo;
}

describe('OAuth from the native shell', () => {
  it('a browser comes back to the web callback', async () => {
    const back = new URL(await redirectToFor(DESKTOP_SAFARI));
    expect(back.protocol).toBe('https:');
    expect(back.pathname).toBe('/auth/callback');
  });

  it('the native shell comes back through the feega:// deep link', async () => {
    expect(await redirectToFor(NATIVE_SHELL)).toBe('feega://auth/callback');
  });

  it('the deep link keeps the invite token', async () => {
    const back = new URL(await redirectToFor(NATIVE_SHELL, { invite_token: 'tok' }));
    expect(back.protocol).toBe('feega:');
    expect(back.searchParams.get('invite_token')).toBe('tok');
  });
});
