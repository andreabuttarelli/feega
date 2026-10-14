const NEVER_CACHED_PREFIXES = ['/api/', '/auth/', '/oauth/'];

export function cacheable(method: string, url: URL, origin: string, shell: ReadonlySet<string>): boolean {
  if (method !== 'GET') {
    return false;
  }
  if (url.origin !== origin) {
    return false;
  }
  if (NEVER_CACHED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return false;
  }
  return shell.has(url.pathname);
}
