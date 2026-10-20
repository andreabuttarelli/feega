const SITE_HOSTS: ReadonlySet<string> = new Set(['www.feega.app', 'feega.app']);

export function isSiteHost(url: URL): boolean {
  return SITE_HOSTS.has(url.hostname.toLowerCase());
}
