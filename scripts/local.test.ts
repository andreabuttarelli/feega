import { describe, expect, it } from 'vitest';
// @ts-expect-error plain mjs
import { fileEnv, localEnv } from './local.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  it.each([
    ['Higgsfield', { HIGGSFIELD_API_KEY_ID: 'i', HIGGSFIELD_API_KEY_SECRET: 's' }],
    ['Wiro', { WIRO_API_KEY: 'k' }],
    ['ElevenLabs', { ELEVENLABS_API_KEY: 'k' }]
  ])('le chiavi %s accendono il flag', (_, keys) => {
    expect(env(keys).PUBLIC_FEEGA_LOCAL_AI).toBe('1');
  });
});

describe('il .env della cartella da cui si lancia', () => {
  const dirWith = (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-env-'));
    writeFileSync(join(dir, '.env'), body);
    return dir;
  };

  it('viene letto, e vince sul .env dell’app', () => {
    const out = fileEnv(dirWith('WIRO_API_KEY=cwd\n'), dirWith('WIRO_API_KEY=app\nKIE_API_KEY=app\n'));

    expect(out).toEqual({ WIRO_API_KEY: 'cwd', KIE_API_KEY: 'app' });
  });

  it('senza .env non c’è niente', () => {
    expect(fileEnv(mkdtempSync(join(tmpdir(), 'feega-env-')), mkdtempSync(join(tmpdir(), 'feega-env-')))).toEqual({});
  });
});
