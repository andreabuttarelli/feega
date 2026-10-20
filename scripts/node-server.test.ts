import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createNodeServer } from './node-server.mjs';

const ALLOW_ORIGIN = 'access-control-allow-origin';

let server: Server | null = null;

afterEach(() => {
  server?.close();
});

async function headerFor(pathname: string) {
  server = createNodeServer((_req, res) => res.end('ok'));
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  return response.headers.get(ALLOW_ORIGIN);
}

describe('the self-hosted server', () => {
  it('lets the sandboxed preview frame load motion libraries', async () => {
    expect(await headerFor('/motion-libs/gsap/gsap.min.js')).toBe('*');
  });

  it('lets the sandboxed preview frame load the motion environment', async () => {
    expect(await headerFor('/motion-env/runtime.js')).toBe('*');
  });

  it('keeps every other route same-origin', async () => {
    expect(await headerFor('/motion-libsx/a.js')).toBeNull();
  });

  it('keeps app routes same-origin', async () => {
    expect(await headerFor('/app')).toBeNull();
  });
});
