import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { tarball } from './tar-fixture';
import { unpack } from './unpack';

describe('unpack', () => {
  it('drops the top folder and keeps the files', () => {
    const files = unpack(tarball({ 'feega-plugin.json': '{}', 'dist/plugin.js': 'x' }));
    expect([...files.keys()].sort()).toEqual(['dist/plugin.js', 'feega-plugin.json']);
    expect(files.get('dist/plugin.js')?.toString()).toBe('x');
  });

  it('refuses a path that climbs out of the folder', () => {
    expect(() => unpack(tarball({ '../escape.js': 'x' }))).toThrow(/unsafe path/);
  });

  it('refuses bytes that are not a gzip archive', () => {
    expect(() => unpack(Buffer.from('not a tarball'))).toThrow(/archive/);
  });

  it('refuses an archive that unpacks past the size limit', () => {
    const bomb = gzipSync(Buffer.alloc(60 * 1024 * 1024));
    expect(() => unpack(bomb)).toThrow(/archive/);
  });
});
