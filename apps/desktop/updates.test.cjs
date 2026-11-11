const test = require('node:test');
const assert = require('node:assert');
const { latestRelease, newer, watchUpdates, CHECK_EVERY_MS, DOWNLOAD } = require('./updates.cjs');

const release = (tag, extra = {}) => ({ tag_name: tag, html_url: `https://github.com/r/${tag}`, draft: false, prerelease: false, assets: [{ name: 'feega-1-mac-arm64.dmg' }], ...extra });

test('versions compare by number, not by text', () => {
  assert.ok(newer('0.10.0', '0.9.1'));
  assert.ok(!newer('0.9.1', '0.10.0'));
  assert.ok(!newer('1.0.0', '1.0.0'));
});

test('the latest release is the highest app tag that carries a mac build', () => {
  const releases = [release('app-v0.3.0', { draft: true }), release('app-v0.2.0'), release('cli-v9.0.0'), release('app-v0.10.0', { prerelease: true }), release('app-v0.9.0', { assets: [{ name: 'feega-app.tar.gz' }] }), release('app-v0.1.5')];
  assert.deepEqual(latestRelease(releases), { version: '0.2.0', url: 'https://github.com/r/app-v0.2.0' });
  assert.equal(latestRelease([]), null);
});

function fakes({ releases, choice = DOWNLOAD, fails = false }) {
  const opened = [];
  const asked = [];
  const timers = [];
  return {
    opened,
    asked,
    timers,
    current: '0.1.0',
    fetch: async () => {
      if (fails) {
        throw new Error('offline');
      }
      return { ok: true, json: async () => releases };
    },
    ask: async (options) => {
      asked.push(options);
      return { response: choice };
    },
    open: (url) => opened.push(url),
    every: (fn, ms) => timers.push({ fn, ms })
  };
}

const settle = () => new Promise(setImmediate);

test('a newer release opens its download page when the user agrees', async () => {
  const f = fakes({ releases: [release('app-v0.2.0')] });
  watchUpdates(f);
  await settle();
  assert.deepEqual(f.opened, ['https://github.com/r/app-v0.2.0']);
  assert.equal(f.timers[0].ms, CHECK_EVERY_MS);
});

test('the same release is offered once per run', async () => {
  const f = fakes({ releases: [release('app-v0.2.0')], choice: DOWNLOAD + 1 });
  watchUpdates(f);
  await settle();
  await f.timers[0].fn();
  await settle();
  assert.equal(f.asked.length, 1);
  assert.deepEqual(f.opened, []);
});

test('no prompt when the app is current', async () => {
  const f = fakes({ releases: [release('app-v0.1.0')] });
  watchUpdates(f);
  await settle();
  assert.equal(f.asked.length, 0);
});

test('a failed check does not crash the app', async () => {
  const f = fakes({ releases: [], fails: true });
  watchUpdates(f);
  await settle();
  assert.equal(f.asked.length, 0);
});

test('with only 0.1.27 carrying a dmg, lower builds are offered it and 0.1.27 or higher are not', () => {
  const bundleOnly = (n) => ({ tag_name: `app-v0.1.${n}`, html_url: `u${n}`, assets: [{ name: 'feega-app.tar.gz' }] });
  const releases = [{ tag_name: 'app-v0.1.27', html_url: 'u27', assets: [{ name: 'feega-0.1.27-mac-arm64.dmg' }] }, bundleOnly(26), bundleOnly(30)];
  const best = latestRelease(releases);
  assert.equal(best.version, '0.1.27');
  assert.ok(newer(best.version, '0.1.0'));
  assert.ok(!newer(best.version, '0.1.27'));
  assert.ok(!newer(best.version, '0.2.0'));
});
