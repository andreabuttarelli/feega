import { posix, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fsUrl, sourceId } from './source-id';

describe('sourceId', () => {
  it('gives posix ids for windows paths', () => {
    expect(sourceId('C:\\work\\app', 'C:\\work\\app\\src\\routes\\+page.svelte', win32)).toBe('src/routes/+page.svelte');
  });

  it('gives posix ids for the forward-slash paths vite hands over on windows', () => {
    expect(sourceId('C:\\work\\app', 'C:/work/app/src/App.jsx', win32)).toBe('src/App.jsx');
  });

  it('keeps posix paths as they are', () => {
    expect(sourceId('/work/app', '/work/app/src/App.jsx', posix)).toBe('src/App.jsx');
  });
});

describe('fsUrl', () => {
  it('prefixes a drive letter path with a slash', () => {
    expect(fsUrl('C:\\a\\b\\bridge.js', win32)).toBe('/@fs/C:/a/b/bridge.js');
  });

  it('keeps a posix absolute path', () => {
    expect(fsUrl('/a/b/bridge.js', posix)).toBe('/@fs/a/b/bridge.js');
  });
});
