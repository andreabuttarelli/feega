const PRODUCTION_URL = 'https://oh.feega.app';
const DEEP_LINK_SCHEME = 'feega:';
const AUTH_HOST = 'auth';
const AUTH_CALLBACK_PATH = '/callback';
const PROJECT_PATH = /^\/p\/([^/]+)/;
const APP_PATH = '/app';
const CANVAS_EXTENSION = '.feega';
const BROWSABLE_SCHEMES = ['http:', 'https:', 'mailto:'];
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
      if (staysInside(url, app())) {
        return;
      }
      event.preventDefault();
      openExternal(url);
    });
  }
}

function settingsUrl(current, app) {
  const project = URL.canParse(current) ? PROJECT_PATH.exec(new URL(current).pathname) : null;
  return new URL(project ? `/p/${project[1]}/settings` : APP_PATH, app).href;
}

function browsable(target) {
  return URL.canParse(target) && BROWSABLE_SCHEMES.includes(new URL(target).protocol);
}

function heldLink() {
  let held = null;
  return {
    keep: (link) => { held = link; },
    take: () => {
      const link = held;
      held = null;
      return link;
    }
  };
}

function droppedCanvas(target) {
  const url = new URL(target);
  if (url.protocol !== 'file:' || !url.pathname.endsWith(CANVAS_EXTENSION)) {
    return null;
  }
  return decodeURIComponent(url.pathname);
}

module.exports = { heldLink, browsable, settingsUrl, droppedCanvas, PRODUCTION_URL, DEEP_LINK_SCHEME, start, authReturn, staysInside, keepInside };
