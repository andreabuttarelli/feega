const PUBLIC_SITE = 'https://feega.app';

const HOSTS_TO_PUBLIC_SITE: ReadonlySet<string> = new Set(['dalnulla.com', 'www.dalnulla.com', 'r.feega.app']);

export function redirectFor(url: URL): string | null {
  if (!HOSTS_TO_PUBLIC_SITE.has(url.hostname.toLowerCase())) {
    return null;
  }

  return `${PUBLIC_SITE}${url.pathname}${url.search}`;
}
