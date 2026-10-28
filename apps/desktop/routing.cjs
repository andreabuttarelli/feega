const PRODUCTION_URL = 'https://oh.feega.app';
const DEEP_LINK_SCHEME = 'feega:';
const AUTH_HOST = 'auth';
const AUTH_CALLBACK_PATH = '/callback';
const SHELL_SCHEMES = ['about:', 'data:', 'devtools:'];

function start(configured) {
  const wanted = (configured ?? '').trim() || PRODUCTION_URL;
  return URL.canParse(wanted) ? new URL(wanted) : new URL(PRODUCTION_URL);
}

function authReturn(deep, app) {
  const link = new URL(deep);
  if (link.protocol !== DEEP_LINK_SCHEME || link.host !== AUTH_HOST || link.pathname !== AUTH_CALLBACK_PATH) {
    return null;
  }
  const target = new URL('/auth/callback', app);
  target.search = link.search;
  return target.href;
}

function staysInside(target, app) {
  const url = new URL(target);
  if (SHELL_SCHEMES.includes(url.protocol)) {
    return true;
  }
  return url.origin === new URL(app).origin;
}

const LEAVING_EVENTS = ['will-navigate', 'will-redirect'];

function keepInside(contents, app, openExternal) {
  for (const name of LEAVING_EVENTS) {
    contents.on(name, (event, url) => {
      if (staysInside(url, app)) {
        return;
      }
      event.preventDefault();
      openExternal(url);
    });
  }
}

module.exports = { PRODUCTION_URL, DEEP_LINK_SCHEME, start, authReturn, staysInside, keepInside };
