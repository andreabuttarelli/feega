const test = require('node:test');
const assert = require('node:assert');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { fileIn, withExtension, savedBounds, saveBounds } = require('./files.cjs');

test('a .feega path on the command line is the file to open', () => {
  assert.equal(fileIn(['/Applications/feega.app/Contents/MacOS/feega', '--flag', '/Users/a/site.feega']), '/Users/a/site.feega');
  assert.equal(fileIn(['/app', 'feega://auth/callback']), null);
});

test('a saved name always ends in .feega', () => {
  assert.equal(withExtension('/Users/a/site'), '/Users/a/site.feega');
  assert.equal(withExtension('/Users/a/site.feega'), '/Users/a/site.feega');
});

test('window bounds survive a restart, and a missing state gives none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feega-desktop-'));
  const state = join(dir, 'window.json');
  assert.equal(savedBounds(state), null);

  saveBounds(state, { x: 10, y: 20, width: 1200, height: 800 });
  assert.deepEqual(savedBounds(state), { x: 10, y: 20, width: 1200, height: 800 });

  writeFileSync(state, 'not json');
  assert.equal(savedBounds(state), null);
});
