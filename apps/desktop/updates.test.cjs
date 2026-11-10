const test = require('node:test');
const assert = require('node:assert');
const { latestRelease, newer, watchUpdates, CHECK_EVERY_MS, DOWNLOAD } = require('./updates.cjs');

const release = (tag, extra = {}) => ({ tag_name: tag, html_url: `https://github.com/r/${tag}`, draft: false, prerelease: false, ...extra });

test('versions compare by number, not by text', () => {
  assert.ok(newer('0.10.0', '0.9.1'));
  assert.ok(!newer('0.9.1', '0.10.0'));
  assert.ok(!newer('1.0.0', '1.0.0'));
});

test('the latest release is the highest desktop tag, drafts and the feed tag aside', () => {
  const releases = [release('desktop-latest'), release('desktop-v0.3.0', { draft: true }), release('desktop-v0.2.0'), release('cli-v9.0.0'), release('desktop-v0.10.0', { prerelease: true }), release('desktop-v0.1.5')];
  assert.deepEqual(latestRelease(releases), { version: '0.2.0', url: 'https://github.com/r/desktop-v0.2.0' });
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
  const f = fakes({ releases: [release('desktop-v0.2.0')] });
  watchUpdates(f);
  await settle();
  assert.deepEqual(f.opened, ['https://github.com/r/desktop-v0.2.0']);
  assert.equal(f.timers[0].ms, CHECK_EVERY_MS);
});

test('the same release is offered once per run', async () => {
  const f = fakes({ releases: [release('desktop-v0.2.0')], choice: DOWNLOAD + 1 });
  watchUpdates(f);
  await settle();
  await f.timers[0].fn();
  await settle();
  assert.equal(f.asked.length, 1);
  assert.deepEqual(f.opened, []);
});

test('no prompt when the app is current', async () => {
  const f = fakes({ releases: [release('desktop-v0.1.0')] });
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
