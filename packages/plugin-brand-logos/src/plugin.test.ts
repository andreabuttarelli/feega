import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, Place, type HostMessage, type PluginMessage, type ProjectInfo, type Proposal, type Source, type UiNode } from '@feega/plugin-api/protocol';
import { OFFLINE_NOTE } from '@feega/plugin-icon-kit/cdn';
import { localCdn } from '@feega/plugin-icon-kit/cdn-fixture';
import manifest from '../feega-plugin.json';
import { VERSION } from './icons';
import { BRAND, CHOSEN, LABEL, QUERY, SECTION, SIZE, brandLogosPlugin } from './plugin';

const at = (file: string): Source => ({ file, line: 4, col: 3 });

const SVELTE = at('src/Hero.svelte');
const ITEM = 'icon';
const SETTLE_MS = 50;
const ICONS_READY_MS = 10_000;
const PLAIN: ProjectInfo = { typescript: true, publicDir: 'public', packages: {} };

function load(target: Source | null) {
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
    project: async () => PLAIN,
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
  brandLogosPlugin(createApi(port));
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
  if (target) {
    host.menu(parsed.manifest.id, ITEM, target);
  }
  return { settle, ui, control, cdn, proposals, notes, manifest: parsed.manifest };
}

const node = <T extends UiNode['type']>(tree: UiNode[], type: T, id?: string) => tree.find((n) => n.type === type && (id === undefined || ('id' in n && n.id === id)));

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

    expect(m.contributions.addMenu).toEqual([{ id: ITEM, title: 'Brand logo', popover: SECTION }]);
    expect(m.contributions.popover).toEqual([{ id: SECTION, title: 'Brand logos' }]);
    expect(m.contributions.rightBar).toBeUndefined();
    expect([...m.grants].sort()).toEqual(['edit.insert', 'project']);
    expect(m.hosts).toEqual(['cdn.jsdelivr.net', 'unpkg.com']);
  });
});

describe('brand logos picker', () => {
  it('shows well known brands before anything is typed', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    const grid = node(plugin.ui(), Control.Grid, CHOSEN);

    expect(grid?.type === Control.Grid && grid.items.map((item) => item.id)).toContain('github');
  });

  it('finds a brand by its title, with spaces and capitals', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.control(QUERY, 'Git Hub');
    const grid = node(plugin.ui(), Control.Grid, CHOSEN);

    expect(grid?.type === Control.Grid && grid.items.map((item) => item.id)).toContain('github');
  });

  it('reminds that logos are trademarks', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();

    expect(JSON.stringify(plugin.ui())).toContain('trademarks');
  });
});

describe('logo files', () => {
  it('draws the logos on show from files pinned to the version of the bundled index', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await vi.waitFor(() => {
      const grid = node(plugin.ui(), Control.Grid, CHOSEN);
      expect(grid?.type === Control.Grid && grid.items.length > 20 && grid.items.every((item) => item.image?.includes('<svg'))).toBe(true);
    }, { timeout: ICONS_READY_MS });

    expect(plugin.cdn.requests.every((url) => url.startsWith(`https://cdn.jsdelivr.net/npm/simple-icons@${VERSION}/icons/`))).toBe(true);
  });

  it('refuses to insert a logo it cannot get, with a note', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    plugin.cdn.offline = true;
    await plugin.control(QUERY, 'gitea');
    await plugin.control(CHOSEN, 'gitea');

    expect(plugin.proposals).toEqual([]);
    expect(plugin.notes).toEqual([OFFLINE_NOTE]);
  });
});

describe('inserting a logo', () => {
  it('writes the brand colour on the tag by default and an accessible title in the svg', async () => {
    const plugin = load(SVELTE);
    await search(plugin, 'github');
    await plugin.control(CHOSEN, 'github');
    const op = insertOp(plugin);

    expect(plugin.proposals[0].label).toBe(LABEL);
    expect(op).toMatchObject({ place: Place.Auto, at: 'src/Hero.svelte:4:3' });
    expect(op.component).toMatchObject({ name: 'GithubIcon', file: 'src/feega/icons/GithubIcon.svelte', attributes: 'color="#181717"' });
    expect(op.component.source).toContain('<title>GitHub</title>');
    expect(op.component.source).toContain('fill={color}');
  });

  it('writes no colour when the logo follows the text colour', async () => {
    const plugin = load(SVELTE);
    await search(plugin, 'github');
    await plugin.control(BRAND, 'current');
    await plugin.control(SIZE, 48);
    await plugin.control(CHOSEN, 'github');

    expect(insertOp(plugin).component.attributes).toBe('size={48}');
  });

  it('escapes the title of a brand that has an ampersand', async () => {
    const plugin = load(SVELTE);
    await search(plugin, '1and1');
    await plugin.control(CHOSEN, '1and1');

    expect(insertOp(plugin).component.source).toContain('<title>1&amp;1</title>');
  });
});
