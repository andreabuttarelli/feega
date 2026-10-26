import { describe, expect, it } from 'vitest';
// @ts-expect-error plain mjs
import { localEnv } from './local.mjs';

const SECRET = 'sk-secret-do-not-leak';

const env = (base: Record<string, string>, fromFile: Record<string, string> = {}) => localEnv('c.feega', '5199', base, fromFile) as Record<string, string>;

describe('npm run local e le chiavi AI', () => {
  it('senza chiavi il flag AI e spento', () => {
    expect(env({}).PUBLIC_FEEGA_LOCAL_AI).toBe('0');
  });

  it('una chiave nel processo accende il flag', () => {
    expect(env({ KIE_API_KEY: SECRET }).PUBLIC_FEEGA_LOCAL_AI).toBe('1');
  });

  it('una chiave nel .env accende il flag e arriva al server', () => {
    const out = env({}, { OPENROUTER_API_KEY: SECRET });

    expect(out.PUBLIC_FEEGA_LOCAL_AI).toBe('1');
    expect(out.OPENROUTER_API_KEY).toBe(SECRET);
  });

  it('il processo vince sul .env', () => {
    expect(env({ KIE_API_KEY: 'process' }, { KIE_API_KEY: 'file' }).KIE_API_KEY).toBe('process');
  });

  it('nessuna variabile pubblica, quindi nessuna che arrivi al browser, porta una chiave', () => {
    const out = env({ KIE_API_KEY: SECRET, LLM_API_KEY: SECRET }, { OPENROUTER_API_KEY: SECRET });
    const pub = Object.entries(out).filter(([name]) => name.startsWith('PUBLIC_'));

    expect(pub.length).toBeGreaterThan(0);
    expect(pub.map(([, value]) => value).join()).not.toContain(SECRET);
  });
});
