import { describe, expect, it } from 'vitest';
import { staleSessionCookieNames } from './stale-session-cookies';

const OWN = 'sb-abc-auth-token';

describe('i cookie di sessione di altri progetti Supabase non si accumulano', () => {
  it('elenca i cookie auth di altri ref, chunk compresi', () => {
    const names = ['sb-xyz-auth-token', 'sb-xyz-auth-token.0', 'sb-xyz-auth-token.1', 'sb-127-auth-token'];
    expect(staleSessionCookieNames(names, OWN)).toEqual(names);
  });

  it('lascia la sessione del proprio ref e i cookie non di sessione', () => {
    const names = [OWN, `${OWN}.0`, `${OWN}.1`, 'dz-org', 'theme', 'sb-xyz-auth-token-code-verifier'];
    expect(staleSessionCookieNames(names, OWN)).toEqual([]);
  });
});
