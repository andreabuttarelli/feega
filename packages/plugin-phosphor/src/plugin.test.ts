import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, type HostMessage, type PluginMessage, type ProjectInfo, type Proposal, type Source, type UiNode } from '@feega/plugin-api/protocol';
import { OFFLINE_NOTE } from '@feega/plugin-icon-kit/cdn';
import { localCdn } from '@feega/plugin-icon-kit/cdn-fixture';
import manifest from '../feega-plugin.json';
import { VERSION } from './icons';
import { CHOSEN, COLOUR, LABEL, QUERY, SECTION, SIZE, WEIGHT, phosphorPlugin } from './plugin';

const at = (file: string): Source => ({ file, line: 4, col: 3 });

const SVELTE = at('src/Hero.svelte');
const ITEM = 'icon';
const SETTLE_MS = 50;
const ICONS_READY_MS = 10_000;
const PLAIN: ProjectInfo = { typescript: true, publicDir: 'public', packages: {} };

function load(target: Source | null, project: ProjectInfo = PLAIN) {
  const parsed = parseManifest({ ...manifest, permissions: manifest.permissions });
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  let open = target !== null;
  const proposals: Proposal[] = [];
  const notes: string[] = [];
  const cdn = localCdn();
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => null,
    project: async () => project,
    sourceText: async () => null,
    propose: async (p) => (proposals.push(p), { ok: true }),
    preview: () => undefined,
    fetch: cdn.fetch,
    pickFile: async () => null,
    notify: (text) => notes.push(text)
  };
  const host = createPluginHost({ editor, sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined }) });
  host.load(parsed.manifest, '');
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  phosphorPlugin(createApi(port));
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    if (open) {
      await vi.waitFor(() => expect(host.ui(parsed.manifest.id, SECTION).length).toBeGreaterThan(0), { timeout: ICONS_READY_MS });
    }
  };
  const ui = () => host.ui(parsed.manifest.id, SECTION);
  const control = async (id: string, value: string | number | boolean) => {
    const before = proposals.length + notes.length;
    host.control(parsed.manifest.id, SECTION, id, value);
    open = open && id !== CHOSEN;
    await settle();
    if (id === CHOSEN) {
      await vi.waitFor(() => expect(proposals.length + notes.length).toBeGreaterThan(before), { timeout: ICONS_READY_MS });
    }
  };
  const imageOf = (name: string) => grid(ui())?.items.find((item) => item.id === name)?.image;
  const drawn = (name: string) => vi.waitFor(() => expect(imageOf(name)).toBeTruthy(), { timeout: ICONS_READY_MS });
  if (target) {
    host.menu(parsed.manifest.id, ITEM, target);
  }
  return { settle, ui, control, imageOf, drawn, cdn, proposals, notes, manifest: parsed.manifest };
}

const node = <T extends UiNode['type']>(tree: UiNode[], type: T, id?: string) => tree.find((n) => n.type === type && (id === undefined || ('id' in n && n.id === id)));

const grid = (tree: UiNode[]) => {
  const found = node(tree, Control.Grid, CHOSEN);
  return found?.type === Control.Grid ? found : null;
};

async function search(plugin: ReturnType<typeof load>, query: string) {
  await plugin.settle();
  await plugin.control(QUERY, query);
}

const insertOp = (plugin: ReturnType<typeof load>) => {
  const [op] = plugin.proposals[0].ops;
  if (op.kind !== OpKind.Insert) {
    throw new Error('not an insert');
  }
  return op;
};

describe('manifest', () => {
  it('adds one Add menu entry that opens its picker and no Properties section, and asks only for what it uses', () => {
    const { manifest: m } = load(null);

    expect(m.contributions.addMenu).toEqual([{ id: ITEM, title: 'Phosphor icon', popover: SECTION }]);
    expect(m.contributions.popover).toEqual([{ id: SECTION, title: 'Phosphor icons' }]);
    expect(m.contributions.rightBar).toBeUndefined();
    expect([...m.grants].sort()).toEqual(['edit.insert', 'project']);
    expect(m.hosts).toEqual(['cdn.jsdelivr.net', 'unpkg.com']);
  });
});

describe('phosphor picker', () => {
  it('shows common icons before anything is typed', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();

    expect(grid(plugin.ui())?.items.map((item) => item.id)).toContain('camera');
  });

  it('finds an icon by one of its tags', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.control(QUERY, 'photography');

    expect(grid(plugin.ui())?.items.map((item) => item.id)).toContain('camera');
  });

  it('draws the grid in the chosen weight', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.drawn('camera');
    const regular = plugin.imageOf('camera');
    await plugin.control(WEIGHT, 'fill');
    await plugin.drawn('camera');

    expect(plugin.imageOf('camera')).not.toBe(regular);
    expect(plugin.cdn.requests.some((url) => url.endsWith(`@phosphor-icons/core@${VERSION}/assets/fill/camera-fill.svg`))).toBe(true);
  });

  it('refuses to insert an icon it cannot get, with a note', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    plugin.cdn.offline = true;
    await plugin.control(QUERY, 'anchor');
    await plugin.control(CHOSEN, 'anchor');

    expect(plugin.proposals).toEqual([]);
    expect(plugin.notes).toEqual([OFFLINE_NOTE]);
  });
});

describe('inserting without an icon package', () => {
  it('inserts the regular weight as an inline svg component', async () => {
    const plugin = load(SVELTE);
    await search(plugin, 'camera');
    await plugin.control(CHOSEN, 'camera');
    const op = insertOp(plugin);

    expect(plugin.proposals[0].label).toBe(LABEL);
    expect(op.component).toMatchObject({ name: 'CameraIcon', file: 'src/feega/icons/CameraIcon.svelte', attributes: '' });
    expect(op.component.source).toContain('viewBox="0 0 256 256"');
    expect(op.component.source).toContain('fill={color}');
  });

  it('gives each weight its own file, so two weights of one icon can live together', async () => {
    const plugin = load(SVELTE);
    await search(plugin, 'camera');
    await plugin.control(WEIGHT, 'bold');
    await plugin.control(CHOSEN, 'camera');

    expect(insertOp(plugin).component).toMatchObject({ name: 'CameraBoldIcon', file: 'src/feega/icons/CameraBoldIcon.svelte' });
  });

  it('writes size and colour on the tag when they differ', async () => {
    const plugin = load(SVELTE);
    await search(plugin, 'camera');
    await plugin.control(SIZE, 48);
    await plugin.control('inherit', false);
    await plugin.control(COLOUR, '#ff0000');
    await plugin.control(CHOSEN, 'camera');

    expect(insertOp(plugin).component.attributes).toBe('size={48} color="#ff0000"');
  });
});

describe('inserting with the icon package the project already has', () => {
  it('re-exports @phosphor-icons/react and passes the weight as a prop', async () => {
    const plugin = load(at('src/App.tsx'), { ...PLAIN, packages: { '@phosphor-icons/react': '^2.1.0' } });
    await search(plugin, 'camera');
    await plugin.control(WEIGHT, 'bold');
    await plugin.control(CHOSEN, 'camera');

    expect(insertOp(plugin).component).toMatchObject({
      name: 'CameraIcon',
      file: 'src/feega/icons/CameraIcon.tsx',
      source: "'use client';\n\nexport { Camera as default } from '@phosphor-icons/react';\n",
      attributes: 'size={24} weight="bold"'
    });
  });

  it('wraps @phosphor-icons/vue with the Ph prefix', async () => {
    const plugin = load(at('src/App.vue'), { ...PLAIN, packages: { '@phosphor-icons/vue': '^2.2.0' } });
    await search(plugin, 'arrow-right');
    await plugin.control(CHOSEN, 'arrow-right');
    const op = insertOp(plugin);

    expect(op.component.source).toContain("import { PhArrowRight } from '@phosphor-icons/vue';");
    expect(op.component.source).toContain('<PhArrowRight />');
    expect(op.component.attributes).toBe(':size="24"');
  });

  it('uses inline svg in a framework the installed package does not serve', async () => {
    const plugin = load(SVELTE, { ...PLAIN, packages: { '@phosphor-icons/react': '^2.1.0' } });
    await search(plugin, 'camera');
    await plugin.control(CHOSEN, 'camera');

    expect(insertOp(plugin).component.source).toContain('<svg');
  });
});
