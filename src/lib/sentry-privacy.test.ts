import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REPLAY_PRIVACY, SENTRY_PRIVACY, scrubEvent } from './sentry-privacy';

describe('Sentry non riceve dati personali', () => {
  it('sendDefaultPii è spento', () => {
    expect(SENTRY_PRIVACY.sendDefaultPii).toBe(false);
  });

  it('il replay maschera testo, input e media', () => {
    expect(REPLAY_PRIVACY).toEqual({ maskAllText: true, maskAllInputs: true, blockAllMedia: true });
  });

  it('toglie body, cookie, header e query della richiesta', () => {
    const event = scrubEvent({
      request: {
        url: 'https://oh.feega.app/p/1?email=a@b.co',
        data: { password: 'x' },
        cookies: { sb: 'token' },
        headers: { authorization: 'Bearer x', cookie: 'sb=token' },
        query_string: 'email=a@b.co'
      }
    });

    expect(event.request).toEqual({ url: 'https://oh.feega.app/p/1' });
  });

  it("dell'utente resta solo l'id", () => {
    const event = scrubEvent({
      user: { id: 'u1', email: 'mario@rossi.it', ip_address: '1.2.3.4', username: 'mario' }
    });

    expect(event.user).toEqual({ id: 'u1' });
  });

  it('cancella gli indirizzi email dal messaggio e dalle eccezioni', () => {
    const event = scrubEvent({
      message: 'invite failed for mario@rossi.it',
      exception: { values: [{ type: 'Error', value: 'no profile for a.b+c@x.co.uk' }] }
    });

    expect(event.message).toBe('invite failed for [email]');
    expect(event.exception?.values?.[0].value).toBe('no profile for [email]');
  });

  it('un evento senza dati personali passa intatto', () => {
    const event = { message: 'boom', tags: { route: '/p' } };
    expect(scrubEvent({ ...event })).toEqual(event);
  });
});

describe('entrambi gli init di Sentry usano la configurazione privata', () => {
  for (const file of ['src/hooks.client.ts', 'src/instrumentation.server.ts']) {
    it(file, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('...SENTRY_PRIVACY');
      expect(source).not.toMatch(/sendDefaultPii:\s*true/);
    });
  }

  it('il replay del client è mascherato', () => {
    expect(readFileSync('src/hooks.client.ts', 'utf8')).toContain('replayIntegration(REPLAY_PRIVACY)');
  });
});
