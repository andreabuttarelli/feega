export const LINKS_CAP = 200;
export const LINKS_REFRESH_MS = 300;

const WEB_PROTOCOLS = new Set(['http:', 'https:']);

function pathOf(anchor, base, origin) {
  const href = anchor.getAttribute('href');
  if (href === null || href.startsWith('#') || anchor.hasAttribute('download')) {
    return null;
  }
  let url;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  return WEB_PROTOCOLS.has(url.protocol) && url.origin === origin ? url.pathname : null;
}

export function linksOf(doc, origin, cap) {
  const paths = new Set();

  for (const anchor of doc.querySelectorAll('a[href]')) {
    const path = pathOf(anchor, doc.baseURI, origin);
    if (path !== null) {
      paths.add(path);
    }
    if (paths.size >= cap) {
      break;
    }
  }

  return [...paths];
}

export function watchLinks(win, report) {
  let timer = null;
  let sent = '';

  return function refresh() {
    if (timer) {
      return;
    }
    timer = win.setTimeout(() => {
      timer = null;
      const paths = linksOf(win.document, win.location.origin, LINKS_CAP);
      const key = JSON.stringify(paths);
      if (paths.length === 0 || key === sent) {
        return;
      }
      sent = key;
      report(paths);
    }, LINKS_REFRESH_MS);
  };
}
