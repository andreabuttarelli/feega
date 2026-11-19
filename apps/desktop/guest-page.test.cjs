const test = require('node:test');
const assert = require('node:assert');
const { guestAllowed, hardenGuest } = require('./guest-page.cjs');

test('a guest page loads only a local dev server', () => {
  assert.equal(guestAllowed('http://localhost:5174/pricing'), true);
  assert.equal(guestAllowed('http://127.0.0.1:3000/'), true);
  assert.equal(guestAllowed('https://evil.example/'), false);
  assert.equal(guestAllowed('file:///etc/passwd'), false);
  assert.equal(guestAllowed('not a url'), false);
});

test('a guest page never gets node or a preload', () => {
  const prefs = { nodeIntegration: true, contextIsolation: false, preload: '/x.js', preloadURL: 'file:///x.js', sandbox: false };
  hardenGuest(prefs);
  assert.deepEqual(prefs, { nodeIntegration: false, nodeIntegrationInSubFrames: false, contextIsolation: true, sandbox: true, webSecurity: true });
});
