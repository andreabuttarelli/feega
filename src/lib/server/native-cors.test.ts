import { describe, expect, it } from 'vitest';
import { nativeCors, NO_CONTENT } from './native-cors';

function req(method: string, path: string, origin?: string) {
  const headers = new Headers(origin ? { origin } : {});
  return { request: new Request(`https://oh.feega.app${path}`, { method, headers }), url: new URL(`https://oh.feega.app${path}`) };
}

describe('the bundled dashboard calls the hosted API from its own origin', () => {
  it('answers the preflight of a native shell origin on the API', () => {
    const { request, url } = req('OPTIONS', '/api/v1/me/bootstrap', 'tauri://localhost');
    const cors = nativeCors(request, url);

    expect(cors?.preflight).toBe(true);
    expect(cors?.headers['access-control-allow-origin']).toBe('tauri://localhost');
    expect(cors?.headers['access-control-allow-headers']).toContain('authorization');
    expect(NO_CONTENT).toBe(204);
  });

  it('the Windows and Android webview origin is a native origin too', () => {
    const { request, url } = req('GET', '/api/v1/me/bootstrap', 'http://tauri.localhost');
    expect(nativeCors(request, url)).toMatchObject({ preflight: false, headers: { 'access-control-allow-origin': 'http://tauri.localhost' } });
  });

  it('any other origin, or a page outside the API, gets nothing', () => {
    expect(nativeCors(req('GET', '/api/v1/me/bootstrap', 'https://evil.com').request, req('GET', '/api/v1/me/bootstrap').url)).toBeNull();
    const page = req('GET', '/app', 'tauri://localhost');
    expect(nativeCors(page.request, page.url)).toBeNull();
  });
});
