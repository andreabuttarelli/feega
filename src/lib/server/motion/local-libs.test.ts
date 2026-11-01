import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localLib } from './local-libs';

const ORIGIN = 'https://www.dazero.co';
const root = mkdtempSync(join(tmpdir(), 'libs-'));
mkdirSync(join(root, 'hyperframes-core@1.0.0'), { recursive: true });
writeFileSync(join(root, 'hyperframes-core@1.0.0', 'runtime.js'), 'ok');

describe('localLib', () => {
  it('a local render reads a motion library from this checkout, so a dead or older PUBLIC_APP_URL cannot hang it', () => {
    expect(localLib(`${ORIGIN}/motion-libs/hyperframes-core@1.0.0/runtime.js`, ORIGIN, root)).toEqual({ path: join(root, 'hyperframes-core@1.0.0', 'runtime.js'), type: 'text/javascript' });
  });

  it('leaves to the network a library this checkout has not built', () => {
    expect(localLib(`${ORIGIN}/motion-libs/p5@9.9.9/p5.js`, ORIGIN, root)).toBeNull();
  });

  it('leaves to the network anything outside the libraries', () => {
    expect(localLib('https://fonts.gstatic.com/motion-libs/x.js', ORIGIN, root)).toBeNull();
    expect(localLib(`${ORIGIN}/fonts/a.woff2`, ORIGIN, root)).toBeNull();
  });

  it('never reads outside the libraries folder', () => {
    expect(localLib(`${ORIGIN}/motion-libs/%2e%2e/%2e%2e/etc/passwd`, ORIGIN, root)).toBeNull();
  });
});
