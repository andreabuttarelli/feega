const test = require('node:test');
const assert = require('node:assert');
const { unshipped } = require('./scripts/prune.cjs');

const files = [
  'build/handler.js',
  'build/handler.js.map',
  'build/client/_app/app.js',
  'build/client/_app/app.js.br',
  'build/client/_app/app.js.gz',
  'node_modules/sharp/lib/index.js',
  'node_modules/sharp/README.md',
  'node_modules/typescript/lib/tsc.js',
  'scripts/local.mjs'
];

test('a module file nothing loads is not shipped', () => {
  const traced = new Set(['build/handler.js', 'node_modules/sharp/lib/index.js']);
  assert.ok(unshipped(files, traced).includes('node_modules/typescript/lib/tsc.js'));
  assert.ok(unshipped(files, traced).includes('node_modules/sharp/README.md'));
  assert.ok(!unshipped(files, traced).includes('node_modules/sharp/lib/index.js'));
});

test('source maps and precompressed copies of the build are not shipped', () => {
  assert.deepStrictEqual(
    unshipped(files, new Set(files)).sort(),
    ['build/client/_app/app.js.br', 'build/client/_app/app.js.gz', 'build/handler.js.map']
  );
});

test('the build and scripts are shipped even when no import reaches them', () => {
  const gone = unshipped(files, new Set());
  assert.ok(!gone.includes('build/client/_app/app.js'));
  assert.ok(!gone.includes('scripts/local.mjs'));
});

test('the ffmpeg binary found by path, not by import, is shipped', () => {
  const ffmpeg = 'node_modules/ffmpeg-static/ffmpeg';
  assert.ok(!unshipped([ffmpeg], new Set()).includes(ffmpeg));
});
