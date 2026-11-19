import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRIDGE_PATH, devProxy, withBridge } from './dev-proxy';

describe('withBridge', () => {
  it('adds the bridge script before </head>', () => {
    expect(withBridge('<html><head><title>x</title></head><body></body></html>')).toBe(`<html><head><title>x</title><script type="module" src="${BRIDGE_PATH}bridge.js"></script></head><body></body></html>`);
  });

  it('a page without head gets it at the start of body', () => {
    expect(withBridge('<body>hi</body>')).toContain(`<body><script type="module" src="${BRIDGE_PATH}bridge.js"></script>hi`);
  });
});

describe('devProxy', () => {
  it('serves the page with the bridge and the bridge files themselves', async () => {
    const app = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<html><head></head><body></body>'));
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    const target = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
    const dir = mkdtempSync(join(tmpdir(), 'bridge-'));
    writeFileSync(join(dir, 'bridge.js'), 'export {};');

    const proxy = await devProxy(target, dir);
    const page = await (await fetch(proxy.url)).text();
    const bridge = await fetch(`${proxy.url}${BRIDGE_PATH.slice(1)}bridge.js`);

    expect(page).toContain(`${BRIDGE_PATH}bridge.js`);
    expect(bridge.headers.get('content-type')).toContain('javascript');
    proxy.close();
    app.close();
  });
});
