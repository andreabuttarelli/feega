import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, Place, type HostMessage, type PluginMessage, type ProjectInfo, type Proposal, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import { OFFLINE_NOTE } from '@feega/plugin-icon-kit/cdn';
import { localCdn } from '@feega/plugin-icon-kit/cdn-fixture';
import manifest from '../feega-plugin.json';
import { VERSION } from './icons';
import { CHOSEN, COLOUR, INHERIT, INSERT, LABEL, PAGE_SIZE, QUERY, RETRY, SECTION, SIZE, STROKE, lucidePlugin } from './plugin';

const at = (file: string): Selection => ({ source: { file, line: 4, col: 3 }, component: null, tag: 'section', name: 'section', classes: 'hero', rect: { x: 0, y: 0, width: 400, height: 200 }, styles: {}, attributes: [] });

const SVELTE = at('src/Hero.svelte');
const AT = 'src/Hero.svelte:4:3';
const SETTLE_MS = 40;
const ICONS_READY_MS = 10_000;
const PLAIN: ProjectInfo = { typescript: true, publicDir: 'public', packages: {} };

function load(initial: Selection | null, project: ProjectInfo = PLAIN) {
  const parsed = parseManifest({ ...manifest, permissions: manifest.permissions });
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  let selection = initial;
  const proposals: Proposal[] = [];
  const notes: string[] = [];
  const cdn = localCdn();
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => selection,
    project: async () => project,
    sourceText: async () => null,
    propose: async (p) => (proposals.push(p), { ok: true }),
    preview: () => undefined,
    fetch: cdn.fetch,
    pickFile: async () => null,
    notify: (text) => notes.push(text)
  };
  const host = createPluginHost({
    editor,
    sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined })
  });
  host.load(parsed.manifest, '');
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  lucidePlugin(createApi(port));
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    if (selection) {
      await vi.waitFor(() => expect(host.ui(parsed.manifest.id, SECTION).length).toBeGreaterThan(0), { timeout: ICONS_READY_MS });
    }
  };
  const ui = () => host.ui(parsed.manifest.id, SECTION);
  const control = async (id: string, value: string | number | boolean, live = false) => {
    const before = proposals.length + notes.length;
    host.control(parsed.manifest.id, SECTION, id, value, live);
    await settle();
    if (id === INSERT) {
      await vi.waitFor(() => expect(proposals.length + notes.length).toBeGreaterThan(before), { timeout: ICONS_READY_MS });
    }
  };
  const drawn = () => vi.waitFor(() => expect(grid(ui())?.items.length && grid(ui())?.items.every((item) => item.image)).toBeTruthy(), { timeout: ICONS_READY_MS });
  const select = async (next: Selection | null) => {
    selection = next;
    host.selectionChanged(next);
    await settle();
  };
  return { settle, ui, control, select, drawn, cdn, proposals, notes, manifest: parsed.manifest };
}

const node = <T extends UiNode['type']>(tree: UiNode[], type: T, id?: string) => tree.find((n) => n.type === type && (id === undefined || ('id' in n && n.id === id)));

const grid = (tree: UiNode[]) => {
  const found = node(tree, Control.Grid, CHOSEN);
  return found?.type === Control.Grid ? found : null;
};

async function choose(plugin: ReturnType<typeof load>, query: string, name: string) {
  await plugin.settle();
  await plugin.control(QUERY, query, true);
  await plugin.control(CHOSEN, name);
}

describe('manifest', () => {
  it('declares one Properties section shown on a selection and asks only for what it uses', () => {
    const { manifest: m } = load(null);

    expect(m.contributions.rightBar).toEqual([{ id: SECTION, title: 'Lucide icons', when: ['selection'] }]);
    expect([...m.grants].sort()).toEqual(['edit.insert', 'project', 'selection']);
    expect(m.hosts).toEqual(['cdn.jsdelivr.net', 'unpkg.com']);
  });
});

describe('picker', () => {
  it('shows nothing without a selection', async () => {
    const plugin = load(null);
    await plugin.settle();

    expect(plugin.ui()).toEqual([]);
  });

  it('offers common icons before anything is typed, each drawn from its own svg', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.drawn();
    const items = grid(plugin.ui())?.items ?? [];

    expect(items.length).toBeGreaterThan(20);
    expect(items.length).toBeLessThanOrEqual(PAGE_SIZE);
    expect(items.every((item) => item.image?.includes('<svg'))).toBe(true);
    expect(items.map((item) => item.id)).toContain('camera');
  });

  it('narrows the grid while typing and writes nothing', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.control(QUERY, 'camera', true);

    expect(grid(plugin.ui())?.items[0].id).toBe('camera');
    expect(node(plugin.ui(), Control.Search, QUERY)).toMatchObject({ value: 'camera' });
    expect(plugin.proposals).toEqual([]);
  });

  it('says when nothing matches', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.control(QUERY, 'zzzzzz', true);

    expect(grid(plugin.ui())?.items).toEqual([]);
    expect(node(plugin.ui(), Control.Note)).toMatchObject({ text: 'No icon matches "zzzzzz".' });
  });

  it('offers to insert only once an icon is chosen', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();

    expect(node(plugin.ui(), Control.Button, INSERT)).toBeUndefined();

    await choose(plugin, 'camera', 'camera');

    expect(node(plugin.ui(), Control.Button, INSERT)).toMatchObject({ label: 'Insert camera' });
    expect(plugin.proposals).toEqual([]);
  });

  it('shows the colour only when the icon does not follow the text colour', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();

    expect(node(plugin.ui(), Control.Colour, COLOUR)).toBeUndefined();

    await plugin.control(INHERIT, false);

    expect(node(plugin.ui(), Control.Colour, COLOUR)).toBeTruthy();
  });
});

describe('icon files', () => {
  it('fetches only the icons on show, pinned to the version of the bundled index', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.drawn();

    expect(plugin.cdn.requests.length).toBeGreaterThan(20);
    expect(plugin.cdn.requests.length).toBeLessThanOrEqual(PAGE_SIZE);
    expect(plugin.cdn.requests.every((url) => url.startsWith(`https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/icons/`))).toBe(true);
  });

  it('does not fetch an icon twice', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.drawn();
    const first = plugin.cdn.requests.length;
    await plugin.control(QUERY, 'camera', true);
    await plugin.control(QUERY, '', true);

    expect(plugin.cdn.requests.length).toBeGreaterThanOrEqual(first);
    expect(new Set(plugin.cdn.requests).size).toBe(plugin.cdn.requests.length);
  });

  it('keeps the icons it has and says what is missing when there is no internet', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.drawn();
    plugin.cdn.offline = true;
    await plugin.control(QUERY, 'camera', true);

    await vi.waitFor(() => expect(node(plugin.ui(), Control.Note)).toMatchObject({ text: OFFLINE_NOTE }), { timeout: ICONS_READY_MS });
    const items = grid(plugin.ui())?.items ?? [];
    expect(items.find((item) => item.id === 'camera')?.image).toBeTruthy();
    expect(items.some((item) => !item.image)).toBe(true);
    expect(node(plugin.ui(), Control.Button, RETRY)).toBeTruthy();
  });

  it('draws the missing icons after a retry once the connection is back', async () => {
    const plugin = load(SVELTE);
    plugin.cdn.offline = true;
    await plugin.settle();
    await vi.waitFor(() => expect(node(plugin.ui(), Control.Note)).toMatchObject({ text: OFFLINE_NOTE }), { timeout: ICONS_READY_MS });
    plugin.cdn.offline = false;
    await plugin.control(RETRY, true);
    await plugin.drawn();

    expect(node(plugin.ui(), Control.Note)).toBeUndefined();
  });

  it('refuses to insert an icon it cannot get, with a note, and writes nothing', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.drawn();
    await plugin.control(QUERY, 'zzz-none', true);
    plugin.cdn.offline = true;
    await plugin.control(QUERY, 'sun', true);
    await plugin.control(CHOSEN, 'sun-dim');
    await plugin.control(INSERT, true);

    expect(plugin.proposals).toEqual([]);
    expect(plugin.notes).toEqual([OFFLINE_NOTE]);
  });
});

describe('inserting without an icon package', () => {
  it('inserts a self-contained svg component next to the selected element and adds no dependency', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);

    expect(plugin.proposals).toHaveLength(1);
    expect(plugin.proposals[0].label).toBe(LABEL);
    const [op] = plugin.proposals[0].ops;
    expect(plugin.proposals[0].ops).toHaveLength(1);
    expect(op).toMatchObject({ kind: OpKind.Insert, at: AT, place: Place.Auto });
    if (op.kind !== OpKind.Insert) {
      throw new Error('not an insert');
    }
    expect(op.component).toMatchObject({ name: 'CameraIcon', file: 'src/feega/icons/CameraIcon.svelte', attributes: '' });
    expect(op.component.source).toContain('<svg');
    expect(op.component.source).toContain('<path');
  });

  it('writes size, stroke and colour on the tag when they differ from the defaults', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(SIZE, 32);
    await plugin.control(STROKE, 1.5);
    await plugin.control(INHERIT, false);
    await plugin.control(COLOUR, '#ff0000');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.attributes).toBe('size={32} strokeWidth={1.5} color="#ff0000"');
  });

  it('keeps the options after an insert so the next icon matches', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(SIZE, 40);

    expect(node(plugin.ui(), Control.Slider, SIZE)).toMatchObject({ value: 40 });
  });

  it('writes a Svelte 4 component in a Svelte 4 project', async () => {
    const plugin = load(SVELTE, { ...PLAIN, packages: { svelte: '^4.2.0' } });
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.source).toContain('export let size = 24;');
  });

  it('writes a React component for a tsx file', async () => {
    const plugin = load(at('src/App.tsx'));
    await choose(plugin, 'sun', 'sun');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.file).toBe('src/feega/icons/SunIcon.tsx');
  });

  it('refuses a file that is not a component, with a note', async () => {
    const plugin = load(at('src/index.html'));
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);

    expect(plugin.proposals).toEqual([]);
    expect(plugin.notes).toEqual(['Add an icon to a Svelte, React, Vue or Astro file.']);
  });
});

describe('inserting with the icon package the project already has', () => {
  it('re-exports lucide-react', async () => {
    const plugin = load(at('src/App.tsx'), { ...PLAIN, packages: { 'lucide-react': '^0.460.0' } });
    await choose(plugin, 'arrow-right', 'arrow-right');
    await plugin.control(SIZE, 32);
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(plugin.proposals[0].ops).toHaveLength(1);
    expect(op.kind === OpKind.Insert && op.component).toMatchObject({ name: 'ArrowRightIcon', file: 'src/feega/icons/ArrowRightIcon.tsx', source: "export { ArrowRight as default } from 'lucide-react';\n", attributes: 'size={32}' });
  });

  it('wraps the lucide-svelte icon', async () => {
    const plugin = load(SVELTE, { ...PLAIN, packages: { 'lucide-svelte': '^0.460.0', svelte: '^5.0.0' } });
    await choose(plugin, 'arrow-right', 'arrow-right');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.file).toBe('src/feega/icons/ArrowRightIcon.svelte');
    expect(op.kind === OpKind.Insert && op.component.source).toContain("import Icon from 'lucide-svelte/icons/arrow-right';");
    expect(op.kind === OpKind.Insert && op.component.source).toContain('<Icon {...props} />');
  });

  it('wraps the @lucide/svelte icon', async () => {
    const plugin = load(SVELTE, { ...PLAIN, packages: { '@lucide/svelte': '^0.500.0', svelte: '^5.0.0' } });
    await choose(plugin, 'arrow-right', 'arrow-right');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.source).toContain("from '@lucide/svelte/icons/arrow-right'");
  });

  it('wraps the lucide-vue-next icon', async () => {
    const plugin = load(at('src/App.vue'), { ...PLAIN, packages: { 'lucide-vue-next': '^0.460.0' } });
    await choose(plugin, 'arrow-right', 'arrow-right');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.source).toContain("import { ArrowRight } from 'lucide-vue-next';");
    expect(op.kind === OpKind.Insert && op.component.source).toContain('<ArrowRight />');
  });

  it('ignores a lucide package that belongs to another framework', async () => {
    const plugin = load(SVELTE, { ...PLAIN, packages: { 'lucide-react': '^0.460.0' } });
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.source).toContain('<svg');
  });

  it('uses inline svg in Astro even with a lucide package installed', async () => {
    const plugin = load(at('src/pages/index.astro'), { ...PLAIN, packages: { 'lucide-react': '^0.460.0' } });
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);
    const [op] = plugin.proposals[0].ops;

    expect(op.kind === OpKind.Insert && op.component.file).toBe('src/feega/icons/CameraIcon.astro');
  });
});
