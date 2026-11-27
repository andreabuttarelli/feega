import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, type HostMessage, type PluginMessage, type ProjectInfo, type Proposal, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import manifest from '../feega-plugin.json';
import { CHOSEN, COLOUR, INSERT, LABEL, QUERY, SECTION, SIZE, WEIGHT, phosphorPlugin } from './plugin';

const at = (file: string): Selection => ({ source: { file, line: 4, col: 3 }, component: null, tag: 'section', name: 'section', classes: '', rect: { x: 0, y: 0, width: 1, height: 1 }, styles: {}, attributes: [] });

const SVELTE = at('src/Hero.svelte');
const SETTLE_MS = 50;
const ICONS_READY_MS = 10_000;
const PLAIN: ProjectInfo = { typescript: true, publicDir: 'public', packages: {} };

function load(initial: Selection | null, project: ProjectInfo = PLAIN) {
  const parsed = parseManifest({ ...manifest, permissions: manifest.permissions });
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  const proposals: Proposal[] = [];
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => initial,
    project: async () => project,
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
  phosphorPlugin(createApi(port));
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

const grid = (tree: UiNode[]) => {
  const found = node(tree, Control.Grid, CHOSEN);
  return found?.type === Control.Grid ? found : null;
};

async function choose(plugin: ReturnType<typeof load>, query: string, name: string) {
  await plugin.settle();
  await plugin.control(QUERY, query);
  await plugin.control(CHOSEN, name);
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

    expect(m.contributions.rightBar).toEqual([{ id: SECTION, title: 'Phosphor icons', when: ['selection'] }]);
    expect([...m.grants].sort()).toEqual(['edit.insert', 'project', 'selection']);
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
    const regular = grid(plugin.ui())?.items.find((item) => item.id === 'camera')?.image;
    await plugin.control(WEIGHT, 'fill');
    const fill = grid(plugin.ui())?.items.find((item) => item.id === 'camera')?.image;

    expect(regular).toBeTruthy();
    expect(fill).not.toBe(regular);
  });
});

describe('inserting without an icon package', () => {
  it('inserts the regular weight as an inline svg component', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);
    const op = insertOp(plugin);

    expect(plugin.proposals[0].label).toBe(LABEL);
    expect(op.component).toMatchObject({ name: 'CameraIcon', file: 'src/feega/icons/CameraIcon.svelte', attributes: '' });
    expect(op.component.source).toContain('viewBox="0 0 256 256"');
    expect(op.component.source).toContain('fill={color}');
  });

  it('gives each weight its own file, so two weights of one icon can live together', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(WEIGHT, 'bold');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component).toMatchObject({ name: 'CameraBoldIcon', file: 'src/feega/icons/CameraBoldIcon.svelte' });
  });

  it('writes size and colour on the tag when they differ', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(SIZE, 48);
    await plugin.control('inherit', false);
    await plugin.control(COLOUR, '#ff0000');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component.attributes).toBe('size={48} color="#ff0000"');
  });
});

describe('inserting with the icon package the project already has', () => {
  it('re-exports @phosphor-icons/react and passes the weight as a prop', async () => {
    const plugin = load(at('src/App.tsx'), { ...PLAIN, packages: { '@phosphor-icons/react': '^2.1.0' } });
    await choose(plugin, 'camera', 'camera');
    await plugin.control(WEIGHT, 'bold');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component).toMatchObject({
      name: 'CameraIcon',
      file: 'src/feega/icons/CameraIcon.tsx',
      source: "'use client';\n\nexport { Camera as default } from '@phosphor-icons/react';\n",
      attributes: 'size={24} weight="bold"'
    });
  });

  it('wraps @phosphor-icons/vue with the Ph prefix', async () => {
    const plugin = load(at('src/App.vue'), { ...PLAIN, packages: { '@phosphor-icons/vue': '^2.2.0' } });
    await choose(plugin, 'arrow-right', 'arrow-right');
    await plugin.control(INSERT, true);
    const op = insertOp(plugin);

    expect(op.component.source).toContain("import { PhArrowRight } from '@phosphor-icons/vue';");
    expect(op.component.source).toContain('<PhArrowRight />');
    expect(op.component.attributes).toBe(':size="24"');
  });

  it('uses inline svg in a framework the installed package does not serve', async () => {
    const plugin = load(SVELTE, { ...PLAIN, packages: { '@phosphor-icons/react': '^2.1.0' } });
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component.source).toContain('<svg');
  });
});
