import { env } from '$env/dynamic/public';
import { bundleApiBase } from './bundle-fetch';

const WEB_PAGES: readonly string[] = ['/changelog', '/report', '/gallery', '/privacy', '/terms', '/docs'];
const NEW_TAB = '_blank';

function isWebPage(pathname: string): boolean {
  return WEB_PAGES.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function webPageUrl(path: string, webHost: string): string | null {
  const url = new URL(path, 'https://bundle');
  return isWebPage(url.pathname) ? `${webHost}${url.pathname}${url.search}` : null;
}

export function openWebPagesOutside(): void {
  const webHost = env.PUBLIC_APP_URL;
  if (!bundleApiBase() || !webHost) {
    return;
  }

  document.addEventListener('click', (event) => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]');
    const href = anchor?.getAttribute('href');
    if (!href?.startsWith('/')) {
      return;
    }
    const target = webPageUrl(href, webHost);
    if (target) {
      event.preventDefault();
      window.open(target, NEW_TAB);
    }
  }, { capture: true });
}
