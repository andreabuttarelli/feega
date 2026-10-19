import { describe, expect, it } from 'vitest';
import { corsPreflight, withCors } from './api-cors';

const API = new URL('https://feega.app/api/v1/me/root');
const ROUTE = new URL('https://feega.app/p/p1/c/c1/assets/a1');

function from(origin: string | null, method = 'GET') {
  return new Request(API, { method, headers: origin ? { origin } : {} });
}

describe('the server answers the native bundles across origins', () => {
  it('a preflight from the Tauri or mobile bundle is allowed, with the bearer header', () => {
    for (const origin of ['tauri://localhost', 'http://tauri.localhost', 'capacitor://localhost']) {
      const answer = corsPreflight(from(origin, 'OPTIONS'), []);
      expect(answer?.status).toBe(204);
      expect(answer?.headers.get('access-control-allow-origin')).toBe(origin);
      expect(answer?.headers.get('access-control-allow-headers')).toContain('authorization');
    }
  });

  it('an origin set for this deployment is allowed too', () => {
    expect(corsPreflight(from('http://localhost:4180', 'OPTIONS'), ['http://localhost:4180'])?.status).toBe(204);
  });

  it('a server route outside /api/v1 answers the bundles too: the canvas still reads some', () => {
    expect(corsPreflight(new Request(ROUTE, { method: 'OPTIONS', headers: { origin: 'tauri://localhost' } }), [])?.status).toBe(204);
  });

  it('any other origin gets nothing extra', () => {
    expect(corsPreflight(from('https://evil.example', 'OPTIONS'), [])).toBeNull();
    expect(withCors(from('https://evil.example'), new Response('{}'), []).headers.get('access-control-allow-origin')).toBeNull();
  });

  it('an allowed answer names the origin and varies on it', () => {
    const answer = withCors(from('tauri://localhost'), new Response('{}'), []);
    expect(answer.headers.get('access-control-allow-origin')).toBe('tauri://localhost');
    expect(answer.headers.get('vary')).toContain('Origin');
  });
});
