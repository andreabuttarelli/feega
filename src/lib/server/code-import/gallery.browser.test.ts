import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumPage } from '$lib/server/motion/chromium-frames';
import { localBrowser } from '$lib/server/web/browser';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { RestNode } from '$lib/server/figma/rest-message';
import { discover } from './component-discovery';
import { Framework } from './run-plan';
import { GALLERY_READY, galleryOf, NOT_DRAWN } from './gallery';

const SOURCES: Record<string, string> = {
  'src/components/Button.tsx': `export function Button({ tone = 'plain', disabled = false, children }: { tone?: 'plain' | 'loud'; disabled?: boolean; children?: React.ReactNode }) { return <button disabled={disabled} style={{ padding: 8, background: tone === 'loud' ? 'red' : 'white' }}>{children}</button>; }`,
  'src/components/Field.tsx': `export function Field({ size = 'md', ...rest }: { size?: 'md' | 'lg' }) { return <input placeholder={size} {...rest} />; }`,
  'src/components/Needy.tsx': `export function Needy({ items }: { items: { id: string }[] }) { return <ul>{items.map((i) => <li key={i.id}>{i.id}</li>)}</ul>; }`,
  'src/components/Hidden.tsx': `export function Hidden({ open = false }: { open?: boolean }) { return open ? null : null; }`
};
const ENTRY = "import { createRoot } from 'react-dom/client';\ncreateRoot(document.getElementById('root')!).render(null);";
const INDEX = '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';

let url = '';
let dir = '';
let close = () => undefined as unknown;

const textsIn = (node: RestNode): string[] => [...(node.characters ? [node.characters] : []), ...(node.children ?? []).flatMap(textsIn)];

beforeAll(async () => {
  if (!process.env.CHROMIUM_PATH) {
    return;
  }
  dir = mkdtempSync(join(tmpdir(), 'feega-gallery-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  Object.entries(SOURCES).forEach(([path, text]) => write(path, text));
  const texts: Record<string, string> = { 'index.html': INDEX, 'src/main.tsx': ENTRY };
  const made = await galleryOf(discover(SOURCES), { framework: Framework.Vite, appDir: '', files: Object.keys(texts) }, async (paths) => Object.fromEntries(paths.map((p) => [p, texts[p]])));
  if (!('files' in made)) {
    throw new Error(made.unrun);
  }
  made.files.forEach((f) => write(f.path, f.content));
  await build({ entryPoints: [join(dir, 'src/feega-gallery.tsx')], bundle: true, format: 'iife', jsx: 'automatic', outfile: join(dir, 'out.js'), nodePaths: [resolve('node_modules')], logLevel: 'silent', define: { 'process.env.NODE_ENV': '"development"' } });
  const html = '<!doctype html><html><body><script src="/out.js"></script></body></html>';
  const server = createServer((req, res) => (req.url?.startsWith('/out.js') ? res.setHeader('content-type', 'text/javascript').end(readFileSync(join(dir, 'out.js'))) : res.setHeader('content-type', 'text/html').end(html)));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/feega-gallery.html?page=0`;
  close = () => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  };
});

afterAll(() => close());

describe.skipIf(!process.env.CHROMIUM_PATH)('the React gallery in a real browser', () => {
  it('draws every declared cell with its props, retries a void element without children, and prints why a component could not render', async () => {
    const tab = await localBrowser(chromiumPage, new URL(url).origin)();
    try {
      await tab.goto(url);
      await tab.waitFor(GALLERY_READY, 10_000);
      const uses = await tab.marks(['Button', 'Field', 'Needy', 'Hidden']);
      const texts = textsIn(((await tab.tree()) as PageTree).root);

      expect(uses.filter((u) => u.component === 'Button').map((u) => u.props)).toEqual([
        { children: 'Button' },
        { disabled: true, children: 'Button' },
        { tone: 'loud', children: 'Button' },
        { tone: 'loud', disabled: true, children: 'Button' }
      ]);
      expect(uses.filter((u) => u.component === 'Field').map((u) => u.props)).toEqual([{}, { size: 'lg' }]);
      expect(texts.some((t) => t.startsWith(`${NOT_DRAWN}Needy: `))).toBe(true);
      expect(uses.some((u) => u.component === 'Hidden')).toBe(false);
    } finally {
      await tab.close();
    }
  });
});
