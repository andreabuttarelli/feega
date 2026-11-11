const MAC = 'darwin';
const BAR_HEIGHT = 48;
const LIGHT_SIZE = 14;
const LIGHTS_LEFT = 16;
const THEMES = {
  dark: { color: '#1f1f1f', symbolColor: '#ffffff' },
  light: { color: '#ffffff', symbolColor: '#1f1f1f' }
};

const NAVIGATION_ABORTED = -3;

const unreachable = (code, mainFrame) => mainFrame && code !== NAVIGATION_ABORTED;

function offlinePage(target) {
  const html = `<!doctype html><meta charset="utf-8"><title>Feega</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#0c0c0c;color:#eee;font:14px -apple-system,system-ui,sans-serif;text-align:center}a{display:inline-block;margin-top:16px;padding:8px 16px;border-radius:4px;background:#eee;color:#0c0c0c;text-decoration:none}</style>
<div><p>feega can't be reached. Check your connection.</p><a href="${target}">Retry</a></div>
<script>addEventListener('online',()=>location.href=${JSON.stringify(target)})</script>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function overlay(dark) {
  return { ...THEMES[dark ? 'dark' : 'light'], height: BAR_HEIGHT };
}

function frameless(platform, dark) {
  if (platform === MAC) {
    return { titleBarStyle: 'hidden', trafficLightPosition: { x: LIGHTS_LEFT, y: (BAR_HEIGHT - LIGHT_SIZE) / 2 } };
  }
  return { titleBarStyle: 'hidden', titleBarOverlay: overlay(dark) };
}

module.exports = { frameless, overlay, offlinePage, unreachable, BAR_HEIGHT, LIGHT_SIZE };
