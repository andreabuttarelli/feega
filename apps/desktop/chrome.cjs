const MAC = 'darwin';
const BAR_HEIGHT = 48;
const LIGHT_SIZE = 14;
const LIGHTS_LEFT = 16;
const THEMES = {
  dark: { color: '#1f1f1f', symbolColor: '#ffffff' },
  light: { color: '#ffffff', symbolColor: '#1f1f1f' }
};

function overlay(dark) {
  return { ...THEMES[dark ? 'dark' : 'light'], height: BAR_HEIGHT };
}

function frameless(platform, dark) {
  if (platform === MAC) {
    return { titleBarStyle: 'hidden', trafficLightPosition: { x: LIGHTS_LEFT, y: (BAR_HEIGHT - LIGHT_SIZE) / 2 } };
  }
  return { titleBarStyle: 'hidden', titleBarOverlay: overlay(dark) };
}

module.exports = { frameless, overlay, BAR_HEIGHT, LIGHT_SIZE };
