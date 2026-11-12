import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumPage } from '$lib/server/motion/chromium-frames';
import { localBrowser } from '$lib/server/web/browser';

const LATE_MS = 900;
const PAGE = `<!doctype html><html><body><main id="main">Article</main><script>
setTimeout(() => { const aside = document.createElement('aside'); aside.id = 'toc'; aside.textContent = 'Table of contents'; document.body.append(aside); }, ${LATE_MS});
</script></body></html>`;

let url = '';
let close = () => undefined as unknown;

beforeAll(async () => {
  if (!process.env.CHROMIUM_PATH) {
    return;
  }
  const server = createServer((_, res) => res.setHeader('content-type', 'text/html').end(PAGE));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  close = () => server.close();
});

afterAll(() => close());

describe.skipIf(!process.env.CHROMIUM_PATH)('settle waits for the DOM in a real browser', () => {
  it('il sommario che compare dopo il caricamento e\' nel DOM quando settle torna', async () => {
    const tab = await localBrowser(chromiumPage, new URL(url).origin)();
    try {
      await tab.goto(url);
      await tab.settle(2_000);

      const tree = JSON.stringify(await tab.tree());

      expect(tree).toContain('Table of contents');
    } finally {
      await tab.close();
    }
  });
});
