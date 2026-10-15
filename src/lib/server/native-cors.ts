export const NO_CONTENT = 204;

const NATIVE_ORIGINS = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);
const API_PREFIX = '/api/v1/';
const PREFLIGHT_MAX_AGE_S = 600;

export type NativeCors = { preflight: boolean; headers: Record<string, string> };

export function nativeCors(request: Request, url: URL): NativeCors | null {
  const origin = request.headers.get('origin');
  if (!origin || !NATIVE_ORIGINS.has(origin) || !url.pathname.startsWith(API_PREFIX)) {
    return null;
  }

  return {
    preflight: request.method === 'OPTIONS',
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-max-age': String(PREFLIGHT_MAX_AGE_S),
      vary: 'origin'
    }
  };
}
