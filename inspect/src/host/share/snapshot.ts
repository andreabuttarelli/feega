import { zipOf, type ZipEntry } from './zip';

const SCRIPTS = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLESHEET_LINK = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
const HREF = /\bhref=["']([^"']+)["']/i;
const SNAPSHOT_TIMEOUT_MS = 5000;

type Fetch = typeof fetch;

const textOf = async (send: Fetch, url: string): Promise<string | null> => {
  const reply = await send(url, { signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS) }).catch(() => null);
  return reply?.ok ? reply.text() : null;
};

export async function snapshotOf(appUrl: string | null, send: Fetch): Promise<Uint8Array | null> {
  const page = appUrl ? await textOf(send, appUrl) : null;
  if (!appUrl || page === null) {
    return null;
  }
  const origin = new URL(appUrl).origin;
  const styles: ZipEntry[] = [];
  let html = page.replace(SCRIPTS, '');

  for (const link of html.match(STYLESHEET_LINK) ?? []) {
    const href = link.match(HREF)?.[1];
    const url = href ? new URL(href, appUrl) : null;
    const css = url?.origin === origin ? await textOf(send, url.toString()) : null;
    if (css === null || !href) {
      continue;
    }
    const name = `styles/${styles.length}.css`;
    styles.push({ name, data: new TextEncoder().encode(css) });
    html = html.replace(link, link.replace(href, name));
  }
  return zipOf([{ name: 'index.html', data: new TextEncoder().encode(html) }, ...styles]);
}
