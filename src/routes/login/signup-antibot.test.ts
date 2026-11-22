import { beforeEach, describe, expect, it, vi } from 'vitest';

const createUser = vi.fn(async (_args: object) => ({ error: null }));
const generateLink = vi.fn(async (_args: object) => ({ data: null, error: null }));
const signInWithPassword = vi.fn(async (_args: object) => ({ error: null }));
const privateEnv: Record<string, string> = {};

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$lib/server/supabase-admin', () => ({
  createAdminClient: () => ({ auth: { admin: { createUser, generateLink } } })
}));

const { actions } = await import('./+page.server');

const SECRET = 'turnstile-secret';
const CHALLENGE_FIELD = 'cf-turnstile-response';

function formEvent(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  const request = new Request('https://feega.app/login', { method: 'POST', body });

  return {
    request,
    url: new URL('https://feega.app/login'),
    cookies: { get: () => undefined, delete: () => undefined },
    locals: {
      supabase: { auth: { signInWithPassword } },
      safeGetSession: async () => ({ user: null }),
      db: async () => null
    }
  } as never;
}

function cloudflareSays(success: boolean) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success }))));
}

async function signup(fields: Record<string, string>) {
  return (actions.signup as (event: never) => Promise<unknown>)(formEvent({ password: 'secret1', ...fields }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete privateEnv.TURNSTILE_SECRET_KEY;
});

describe('signup anti-bot', () => {
  it('rifiuta un dominio bloccato senza creare l utente', async () => {
    const result = (await signup({ email: 'bot@ghoil.xyz' })) as { status: number; data: { errorCode: string } };

    expect(result.status).toBe(400);
    expect(result.data.errorCode).toBe('blockedDomain');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rifiuta un dominio usa-e-getta con lo stesso codice', async () => {
    const result = (await signup({ email: 'bot@0-mail.com' })) as { data: { errorCode: string } };

    expect(result.data.errorCode).toBe('blockedDomain');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('senza chiavi Turnstile crea l utente', async () => {
    await signup({ email: 'ada@gmail.com' }).catch(() => null);

    expect(createUser).toHaveBeenCalledOnce();
  });

  it('con chiavi e senza token non crea l utente', async () => {
    privateEnv.TURNSTILE_SECRET_KEY = SECRET;
    cloudflareSays(true);

    const result = (await signup({ email: 'ada@gmail.com' })) as { data: { errorCode: string } };

    expect(result.data.errorCode).toBe('captchaFailed');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('con un token respinto da Cloudflare non crea l utente', async () => {
    privateEnv.TURNSTILE_SECRET_KEY = SECRET;
    cloudflareSays(false);

    const result = (await signup({ email: 'ada@gmail.com', [CHALLENGE_FIELD]: 'tok' })) as { data: { errorCode: string } };

    expect(result.data.errorCode).toBe('captchaFailed');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('con un token valido crea l utente', async () => {
    privateEnv.TURNSTILE_SECRET_KEY = SECRET;
    cloudflareSays(true);

    await signup({ email: 'ada@gmail.com', [CHALLENGE_FIELD]: 'tok' }).catch(() => null);

    expect(createUser).toHaveBeenCalledOnce();
  });
});

describe('reset anti-bot', () => {
  const reset = (fields: Record<string, string>) => (actions.reset as (event: never) => Promise<unknown>)(formEvent(fields));

  it('con chiavi e senza token non genera il link', async () => {
    privateEnv.TURNSTILE_SECRET_KEY = SECRET;
    cloudflareSays(true);

    const result = (await reset({ email: 'ada@gmail.com' })) as { data: { errorCode: string } };

    expect(result.data.errorCode).toBe('captchaFailed');
    expect(generateLink).not.toHaveBeenCalled();
  });

  it('un dominio bloccato riceve la risposta neutra e nessun link', async () => {
    const result = await reset({ email: 'bot@ghoil.xyz' });

    expect(result).toEqual({ reset: true, email: 'bot@ghoil.xyz' });
    expect(generateLink).not.toHaveBeenCalled();
  });
});
