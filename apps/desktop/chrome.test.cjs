const test = require('node:test');
const assert = require('node:assert');
const { frameless, overlay, STRIP } = require('./chrome.cjs');

test('macOS keeps the traffic lights inside the drag strip', () => {
  const mac = frameless('darwin', true);
  assert.equal(mac.titleBarStyle, 'hidden');
  assert.ok(mac.trafficLightPosition.y < STRIP);
  assert.equal(mac.titleBarOverlay, undefined);
});

test('Windows and Linux keep native controls as a strip-high overlay', () => {
  for (const os of ['win32', 'linux']) {
    const win = frameless(os, true);
    assert.equal(win.titleBarStyle, 'hidden');
    assert.equal(win.titleBarOverlay.height, STRIP);
  }
});

test('the overlay follows the theme', () => {
  assert.notDeepEqual(overlay(true), overlay(false));
});
