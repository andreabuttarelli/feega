const test = require('node:test');
const assert = require('node:assert');
const { frameless, overlay, offlinePage, unreachable, BAR_HEIGHT, LIGHT_SIZE } = require('./chrome.cjs');

test('macOS centres the traffic lights on the app bar', () => {
  const mac = frameless('darwin', true);
  assert.equal(mac.titleBarStyle, 'hidden');
  assert.equal(mac.trafficLightPosition.y + LIGHT_SIZE / 2, BAR_HEIGHT / 2);
  assert.equal(mac.titleBarOverlay, undefined);
});

test('Windows and Linux keep native controls as tall as the app bar', () => {
  for (const os of ['win32', 'linux']) {
    const win = frameless(os, true);
    assert.equal(win.titleBarStyle, 'hidden');
    assert.equal(win.titleBarOverlay.height, BAR_HEIGHT);
  }
});

test('the overlay follows the theme', () => {
  assert.notDeepEqual(overlay(true), overlay(false));
});

test('the offline page retries the address that failed', () => {
  const page = decodeURIComponent(offlinePage('https://oh.feega.app/p/1'));
  assert.ok(page.startsWith('data:text/html'));
  assert.ok(page.includes('href="https://oh.feega.app/p/1"'));
});

test('only a real main-frame failure shows the offline page', () => {
  assert.ok(unreachable(-106, true));
  assert.ok(!unreachable(-3, true));
  assert.ok(!unreachable(-106, false));
});
