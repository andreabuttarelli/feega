import { describe, expect, it } from 'vitest';
import { checkLocalKeys, KeyVerdict } from './key-checks';

type Seen = { url: string; method: string; headers: Record<string, string> };

function fakeFetch(status: number, seen: Seen[] = []) {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    seen.push({ url: String(input), method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string> });
    return new Response('{}', { status });
  }) as typeof fetch;
}

const ALL = {
  KIE_API_KEY: 'kie',
  OPENROUTER_API_KEY: 'or',
  LLM_API_KEY: 'llm',
  HIGGSFIELD_API_KEY_ID: 'hid',
  HIGGSFIELD_API_KEY_SECRET: 'hsec',
  WIRO_API_KEY: 'wiro',
  ELEVENLABS_API_KEY: 'el'
};

describe('la prova delle chiavi in locale', () => {
  it('prova solo i provider con le chiavi', async () => {
    const seen: Seen[] = [];

    const out = await checkLocalKeys({ ELEVENLABS_API_KEY: 'el' }, fakeFetch(200, seen));

    expect(out).toEqual([{ provider: 'elevenlabs', verdict: KeyVerdict.Works }]);
    expect(seen).toEqual([{ url: 'https://api.elevenlabs.io/v1/user', method: 'GET', headers: { 'xi-api-key': 'el' } }]);
  });

  it('non chiama mai un endpoint che genera', async () => {
    const seen: Seen[] = [];

    await checkLocalKeys(ALL, fakeFetch(200, seen));

    expect(seen.map((s) => s.url).sort()).toEqual([
      'https://api.elevenlabs.io/v1/user',
      'https://api.higgsfield.ai/requests/feega-key-check/status',
      'https://api.kie.ai/api/v1/chat/credit',
      'https://api.wiro.ai/v1/Task/Detail',
      'https://openrouter.ai/api/v1/key',
      'https://openrouter.ai/api/v1/key'
    ]);
  });

  it('401 e 403 dicono chiave rifiutata', async () => {
    expect(await checkLocalKeys({ KIE_API_KEY: 'x' }, fakeFetch(401))).toEqual([{ provider: 'kie', verdict: KeyVerdict.Rejected }]);
    expect(await checkLocalKeys({ WIRO_API_KEY: 'x' }, fakeFetch(403))).toEqual([{ provider: 'wiro', verdict: KeyVerdict.Rejected }]);
  });

  it('un 404 su un task che non esiste vuol dire che la chiave è passata', async () => {
    expect(await checkLocalKeys({ HIGGSFIELD_API_KEY_ID: 'i', HIGGSFIELD_API_KEY_SECRET: 's' }, fakeFetch(404))).toEqual([{ provider: 'higgsfield', verdict: KeyVerdict.Works }]);
  });

  it('una rete che cade non è una chiave sbagliata', async () => {
    const down = (async () => {
      throw new Error('offline');
    }) as typeof fetch;

    expect(await checkLocalKeys({ ELEVENLABS_API_KEY: 'el' }, down)).toEqual([{ provider: 'elevenlabs', verdict: KeyVerdict.Unreachable }]);
  });

  it('rispetta la base URL scelta', async () => {
    const seen: Seen[] = [];

    await checkLocalKeys({ ELEVENLABS_API_KEY: 'el', ELEVENLABS_BASE_URL: 'http://proxy.test/' }, fakeFetch(200, seen));

    expect(seen[0].url).toBe('http://proxy.test/v1/user');
  });
});
