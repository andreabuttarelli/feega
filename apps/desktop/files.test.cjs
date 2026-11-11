const test = require('node:test');
const assert = require('node:assert');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { fileIn, withExtension, startFile, remember } = require('./files.cjs');

test('a .feega path on the command line is the file to open', () => {
  assert.equal(fileIn(['/Applications/feega.app/Contents/MacOS/feega', '--flag', '/Users/a/site.feega']), '/Users/a/site.feega');
  assert.equal(fileIn(['/app', 'feega://auth/callback']), null);
});

test('a saved name always ends in .feega', () => {
  assert.equal(withExtension('/Users/a/site'), '/Users/a/site.feega');
  assert.equal(withExtension('/Users/a/site.feega'), '/Users/a/site.feega');
});

test('the start file is the last one opened while it still exists, else a fresh one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'feega-desktop-'));
  const state = join(dir, 'state.json');
  const fresh = join(dir, 'Untitled.feega');
  assert.equal(startFile(state, fresh), fresh);

  const kept = join(dir, 'kept.feega');
  writeFileSync(kept, '');
  remember(state, kept);
  assert.equal(startFile(state, fresh), kept);

  remember(state, join(dir, 'gone.feega'));
  assert.equal(startFile(state, fresh), fresh);
});
