const test = require('node:test');
const assert = require('node:assert');
const { frameless } = require('./chrome.cjs');

test('macOS hides the title bar but keeps a native frame', () => {
  assert.deepEqual(frameless('darwin'), { titleBarStyle: 'hidden' });
});

test('Windows and Linux drop the frame entirely', () => {
  assert.deepEqual(frameless('win32'), { frame: false });
  assert.deepEqual(frameless('linux'), { frame: false });
});
