const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const GUEST_PREFERENCES = { nodeIntegration: false, nodeIntegrationInSubFrames: false, contextIsolation: true, sandbox: true, webSecurity: true };

function guestAllowed(src) {
  try {
    const url = new URL(src);
    return WEB_PROTOCOLS.has(url.protocol) && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function hardenGuest(prefs) {
  delete prefs.preload;
  delete prefs.preloadURL;
  Object.assign(prefs, GUEST_PREFERENCES);
}

function guardGuests(contents) {
  contents.on('will-attach-webview', (event, prefs, params) => {
    hardenGuest(prefs);
    if (!guestAllowed(params.src)) {
      event.preventDefault();
    }
  });
}

module.exports = { guestAllowed, hardenGuest, guardGuests };
