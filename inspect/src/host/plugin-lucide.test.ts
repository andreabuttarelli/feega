import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import type { HostMessage, PluginMessage, Selection } from '@feega/plugin-api/protocol';
import { localCdn } from '@feega/plugin-icon-kit/cdn-fixture';
import manifest from '@feega/plugin-lucide/manifest';
import { CHOSEN, QUERY, SECTION, lucidePlugin } from '@feega/plugin-lucide/plugin';
import { fileEdits } from './file-edits';

const SETTLE_MS = 60;
const ICONS_READY_MS = 10_000;
const MENU_ITEM = 'icon';

const selectionOf = (file: string, line: number, col: number): Selection => ({ source: { file, line, col }, component: null, tag: 'section', name: 'section', classes: '', rect: { x: 0, y: 0, width: 1, height: 1 }, styles: {}, attributes: [] });

async function insertCamera(file: string, page: string, packages: Record<string, string>, at: [number, number] = [1, 1]) {
  const root = mkdtempSync(join(tmpdir(), 'lucide-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'demo', dependencies: packages }));
  writeFileSync(join(root, file), page);
  const edits = fileEdits(root);
  const parsed = parseManifest({ ...manifest, permissions: manifest.permissions });
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const selection = selectionOf(file, ...at);
  const editor: EditorPort = {
    selection: () => selection,
    project: async () => ({ typescript: false, publicDir: 'public', packages }),
    sourceText: async () => null,
    propose: async (proposal) => {
      const written = await edits.proposal(proposal, '');
      return written.ok ? { ok: true } : { ok: false, reason: written.reason };
    },
    preview: () => undefined,
    fetch: localCdn().fetch,
    pickFile: async () => null,
    notify: () => undefined
  };
  const host = createPluginHost({ editor, sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined }) });
  host.load(parsed.manifest, '');
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  lucidePlugin(createApi(port));
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    await vi.waitFor(() => expect(host.ui(parsed.manifest.id, SECTION).length).toBeGreaterThan(0), { timeout: ICONS_READY_MS });
  };
  host.menu(parsed.manifest.id, MENU_ITEM, selection.source);
  await settle();
  host.control(parsed.manifest.id, SECTION, QUERY, 'camera');
  await settle();
  host.control(parsed.manifest.id, SECTION, CHOSEN, 'camera');
  await vi.waitFor(() => expect(edits.history()).toHaveLength(1), { timeout: ICONS_READY_MS });
  return { read: (path: string) => readFileSync(join(root, path), 'utf8'), edits };
}

describe('Lucide icons, from the Add menu to the files', () => {
  it('writes an inline svg component, the import and the tag, and undoes it in one step', async () => {
    const page = '<section class="hero">\n  <h1>Hi</h1>\n</section>\n';
    const { read, edits } = await insertCamera('src/Page.svelte', page, { svelte: '^5.0.0' });

    expect(read('src/feega/icons/CameraIcon.svelte')).toContain('<svg');
    expect(read('src/Page.svelte')).toContain("import CameraIcon from './feega/icons/CameraIcon.svelte';");
    expect(read('src/Page.svelte')).toContain('<CameraIcon />');
    expect(edits.history()).toMatchObject([{ prop: 'plugin', value: 'Lucide icon' }]);

    await edits.undo();

    expect(read('src/Page.svelte')).toBe(page);
  });

  it('re-exports lucide-react when the project has it', async () => {
    const page = 'export default function App() {\n  return (\n    <section>\n      <h1>Hi</h1>\n    </section>\n  );\n}\n';
    const { read } = await insertCamera('src/App.jsx', page, { react: '^19.0.0', 'lucide-react': '^0.460.0' }, [3, 5]);

    expect(read('src/feega/icons/CameraIcon.jsx')).toBe("export { Camera as default } from 'lucide-react';\n");
    expect(read('src/App.jsx')).toContain("import CameraIcon from './feega/icons/CameraIcon';");
    expect(read('src/App.jsx')).toContain('<CameraIcon />');
  });
});
