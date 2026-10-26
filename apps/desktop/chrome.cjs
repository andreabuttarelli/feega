const MAC = 'darwin';
const STRIP = 28;
const THEMES = {
  dark: { color: '#1f1f1f', symbolColor: '#ffffff' },
  light: { color: '#ffffff', symbolColor: '#1f1f1f' }
};

function overlay(dark) {
  return { ...THEMES[dark ? 'dark' : 'light'], height: STRIP };
}

function frameless(platform, dark) {
  if (platform === MAC) {
    return { titleBarStyle: 'hidden', trafficLightPosition: { x: 12, y: 8 } };
  }
  return { titleBarStyle: 'hidden', titleBarOverlay: overlay(dark) };
}

module.exports = { frameless, overlay, STRIP };
