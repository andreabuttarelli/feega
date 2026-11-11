const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { start, authReturn, staysInside, keepInside, settingsUrl, droppedCanvas, browsable, heldLink, PRODUCTION_URL } = require('./routing.cjs');

test('production is the default start', () => {
  assert.equal(start(undefined).href, new URL(PRODUCTION_URL).href);
  assert.equal(start(' ').href, new URL(PRODUCTION_URL).href);
  assert.equal(start('not a url').href, new URL(PRODUCTION_URL).href);
});

test('a dev url can be configured', () => {
  assert.equal(start('http://localhost:5173').href, 'http://localhost:5173/');
});

test('the oauth deep link returns to the web callback with its code', () => {
  const back = authReturn('feega://auth/callback?code=abc&invite_token=t', 'https://oh.feega.app/p/x');
  assert.equal(back, 'https://oh.feega.app/auth/callback?code=abc&invite_token=t');
});

test('other deep links are not auth returns', () => {
  assert.equal(authReturn('feega://p/123', 'https://oh.feega.app'), null);
  assert.equal(authReturn('other://auth/callback?code=x', 'https://oh.feega.app'), null);
});

test('only the app origin stays in the window', () => {
  assert.ok(staysInside('https://oh.feega.app/login', 'https://oh.feega.app'));
  assert.ok(!staysInside('https://accounts.google.com/o/oauth2', 'https://oh.feega.app'));
  assert.ok(staysInside('about:blank', 'https://oh.feega.app'));
});

function leave(event, url) {
  const contents = new EventEmitter();
  const opened = [];
  keepInside(contents, () => 'https://oh.feega.app/', (target) => opened.push(target));
  let prevented = false;
  contents.emit(event, { preventDefault: () => { prevented = true; } }, url);
  return { prevented, opened };
}

test('a server redirect to the oauth provider opens the browser', () => {
  const google = 'https://accounts.google.com/o/oauth2/auth';
  assert.deepEqual(leave('will-redirect', google), { prevented: true, opened: [google] });
});

test('a link to another site opens the browser', () => {
  assert.deepEqual(leave('will-navigate', 'https://x.com/feega'), { prevented: true, opened: ['https://x.com/feega'] });
});

test('a redirect inside the app stays in the window', () => {
  assert.deepEqual(leave('will-redirect', 'https://oh.feega.app/app'), { prevented: false, opened: [] });
});

test('settings opens the current project settings, else the app home', () => {
  assert.equal(settingsUrl('https://oh.feega.app/p/p1/c/c9', 'https://oh.feega.app/'), 'https://oh.feega.app/p/p1/settings');
  assert.equal(settingsUrl('https://oh.feega.app/app', 'https://oh.feega.app/'), 'https://oh.feega.app/app');
  assert.equal(settingsUrl('data:text/html,x', 'https://oh.feega.app/'), 'https://oh.feega.app/app');
});

test('a dropped .feega file is opened, any other file is left to the page', () => {
  assert.equal(droppedCanvas('file:///Users/a/site.feega'), '/Users/a/site.feega');
  assert.equal(droppedCanvas('file:///Users/a/photo.png'), null);
  assert.equal(droppedCanvas('https://example.com/x.feega'), null);
});

test('only web and mail links leave for the system, never file or app schemes', () => {
  assert.ok(browsable('https://github.com/x'));
  assert.ok(browsable('mailto:hi@feega.app'));
  assert.ok(!browsable('file:///Applications/Calculator.app'));
  assert.ok(!browsable('smb://host/share'));
  assert.ok(!browsable('vscode://x'));
  assert.ok(!browsable('not a url'));
});

test('a link that arrives before the window exists is kept for the first window', () => {
  const held = heldLink();
  assert.equal(held.take(), null);
  held.keep('feega://auth/callback?code=x');
  assert.equal(held.take(), 'feega://auth/callback?code=x');
  assert.equal(held.take(), null);
});
