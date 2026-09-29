const SIGNED_TOKEN = /([?&]token=)([^&"\\]+)/g;
const MS_PER_S = 1000;

function expiryMs(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * MS_PER_S : 0;
  } catch {
    return 0;
  }
}

function anyExpired(json: string, now: number): boolean {
  return [...json.matchAll(SIGNED_TOKEN)].some(([, , jwt]) => expiryMs(jwt) <= now);
}

function unsigned(json: string): string {
  return json.replace(SIGNED_TOKEN, '$1');
}

export function keepSame<T>(shown: T, fetched: T, now: number): T {
  const before = JSON.stringify(shown);
  if (anyExpired(before, now)) {
    return fetched;
  }
  return unsigned(before) === unsigned(JSON.stringify(fetched)) ? shown : fetched;
}
