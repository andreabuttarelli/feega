import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, Place, type HostMessage, type PluginMessage, type ProjectInfo, type Proposal, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import manifest from '../feega-plugin.json';
import { BRAND, CHOSEN, INSERT, LABEL, QUERY, SECTION, SIZE, brandLogosPlugin } from './plugin';

const at = (file: string): Selection => ({ source: { file, line: 4, col: 3 }, component: null, tag: 'section', name: 'section', classes: '', rect: { x: 0, y: 0, width: 1, height: 1 }, styles: {}, attributes: [] });

const SVELTE = at('src/Hero.svelte');
const SETTLE_MS = 50;
const ICONS_READY_MS = 10_000;
const PLAIN: ProjectInfo = { typescript: true, publicDir: 'public', packages: {} };

function load(initial: Selection | null) {
  const parsed = parseManifest({ ...manifest, permissions: manifest.permissions });
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  const proposals: Proposal[] = [];
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => initial,
    project: async () => PLAIN,
    sourceText: async () => null,
    propose: async (p) => (proposals.push(p), { ok: true }),
    preview: () => undefined,
    fetch: async () => ({ status: 200, text: '' }),
    pickFile: async () => null,
    notify: () => undefined
  };
  const host = createPluginHost({ editor, sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined }) });
  host.load(parsed.manifest, '');
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  brandLogosPlugin(createApi(port));
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    if (initial) {
      await vi.waitFor(() => expect(host.ui(parsed.manifest.id, SECTION).length).toBeGreaterThan(0), { timeout: ICONS_READY_MS });
    }
  };
  const ui = () => host.ui(parsed.manifest.id, SECTION);
  const control = async (id: string, value: string | number | boolean) => {
    host.control(parsed.manifest.id, SECTION, id, value);
    await settle();
  };
  return { settle, ui, control, proposals, manifest: parsed.manifest };
}

const node = <T extends UiNode['type']>(tree: UiNode[], type: T, id?: string) => tree.find((n) => n.type === type && (id === undefined || ('id' in n && n.id === id)));

async function choose(plugin: ReturnType<typeof load>, query: string, slug: string) {
  await plugin.settle();
  await plugin.control(QUERY, query);
  await plugin.control(CHOSEN, slug);
}

const insertOp = (plugin: ReturnType<typeof load>) => {
  const [op] = plugin.proposals[0].ops;
  if (op.kind !== OpKind.Insert) {
    throw new Error('not an insert');
  }
  return op;
};

describe('manifest', () => {
  it('declares one Properties section and asks only for what it uses', () => {
    const { manifest: m } = load(null);

    expect(m.contributions.rightBar).toEqual([{ id: SECTION, title: 'Brand logos', when: ['selection'] }]);
    expect([...m.grants].sort()).toEqual(['edit.insert', 'project', 'selection']);
    expect(m.hosts).toEqual([]);
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

describe('inserting a logo', () => {
  it('writes the brand colour on the tag by default and an accessible title in the svg', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'github', 'github');
    await plugin.control(INSERT, true);
    const op = insertOp(plugin);

    expect(plugin.proposals[0].label).toBe(LABEL);
    expect(op).toMatchObject({ place: Place.Auto, at: 'src/Hero.svelte:4:3' });
    expect(op.component).toMatchObject({ name: 'GithubIcon', file: 'src/feega/icons/GithubIcon.svelte', attributes: 'color="#181717"' });
    expect(op.component.source).toContain('<title>GitHub</title>');
    expect(op.component.source).toContain('fill={color}');
  });

  it('writes no colour when the logo follows the text colour', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'github', 'github');
    await plugin.control(BRAND, 'current');
    await plugin.control(SIZE, 48);
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component.attributes).toBe('size={48}');
  });

  it('escapes the title of a brand that has an ampersand', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, '1and1', '1and1');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component.source).toContain('<title>1&amp;1</title>');
  });
});
