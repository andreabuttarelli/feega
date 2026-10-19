const NO_CONTENT = 204;
const PREFLIGHT_MAX_AGE_S = 600;

const NATIVE_ORIGINS: ReadonlySet<string> = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', 'capacitor://localhost', 'https://localhost']);

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'authorization, content-type';

function allowedOrigin(request: Request, extra: readonly string[]): string | null {
  const origin = request.headers.get('origin');
  if (!origin) {
    return null;
  }
  return NATIVE_ORIGINS.has(origin) || extra.includes(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': ALLOWED_METHODS, 'access-control-allow-headers': ALLOWED_HEADERS, vary: 'Origin' };
}

export function corsPreflight(request: Request, extra: readonly string[]): Response | null {
  const origin = request.method === 'OPTIONS' ? allowedOrigin(request, extra) : null;
  if (!origin) {
    return null;
  }
  return new Response(null, { status: NO_CONTENT, headers: { ...corsHeaders(origin), 'access-control-max-age': String(PREFLIGHT_MAX_AGE_S) } });
}

export function withCors(request: Request, response: Response, extra: readonly string[]): Response {
  const origin = allowedOrigin(request, extra);
  if (!origin) {
    return response;
  }
  const answer = new Response(response.body, response);
  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    answer.headers.set(name, value);
  }
  return answer;
}

export function extraOrigins(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
}
