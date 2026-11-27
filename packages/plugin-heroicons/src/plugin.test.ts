import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, type HostMessage, type PluginMessage, type ProjectInfo, type Proposal, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import { OFFLINE_NOTE } from '@feega/plugin-icon-kit/cdn';
import { localCdn } from '@feega/plugin-icon-kit/cdn-fixture';
import manifest from '../feega-plugin.json';
import { VERSION } from './icons';
import { CHOSEN, COLOUR, INHERIT, INSERT, LABEL, QUERY, SECTION, SIZE, STYLE, heroiconsPlugin } from './plugin';

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
  const notes: string[] = [];
  const cdn = localCdn();
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => initial,
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
  heroiconsPlugin(createApi(port));
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    if (initial) {
      await vi.waitFor(() => expect(host.ui(parsed.manifest.id, SECTION).length).toBeGreaterThan(0), { timeout: ICONS_READY_MS });
    }
  };
  const ui = () => host.ui(parsed.manifest.id, SECTION);
  const control = async (id: string, value: string | number | boolean) => {
    const before = proposals.length + notes.length;
    host.control(parsed.manifest.id, SECTION, id, value);
    await settle();
    if (id === INSERT) {
      await vi.waitFor(() => expect(proposals.length + notes.length).toBeGreaterThan(before), { timeout: ICONS_READY_MS });
    }
  };
  return { settle, ui, control, cdn, proposals, notes, manifest: parsed.manifest };
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

    expect(m.contributions.rightBar).toEqual([{ id: SECTION, title: 'Heroicons', when: ['selection'] }]);
    expect([...m.grants].sort()).toEqual(['edit.insert', 'project', 'selection']);
    expect(m.hosts).toEqual(['cdn.jsdelivr.net', 'unpkg.com']);
  });
});

describe('heroicons picker', () => {
  it('shows common icons before anything is typed', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();

    expect(grid(plugin.ui())?.items.map((item) => item.id)).toContain('camera');
  });

  it('hides the icons a style does not have', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.control(QUERY, 'arrow-small-down');

    expect(grid(plugin.ui())?.items.map((item) => item.id)).toEqual(['arrow-small-down']);

    await plugin.control(STYLE, 'micro');

    expect(grid(plugin.ui())?.items).toEqual([]);
  });
});

describe('icon files', () => {
  it('draws the icons on show from the file of the chosen style, pinned to the version of the index', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    await plugin.control(STYLE, 'mini');
    await vi.waitFor(() => expect(grid(plugin.ui())?.items.every((item) => item.image?.includes('<svg'))).toBe(true), { timeout: ICONS_READY_MS });

    expect(plugin.cdn.requests.some((url) => url === `https://cdn.jsdelivr.net/npm/heroicons@${VERSION}/20/solid/camera.svg`)).toBe(true);
  });

  it('refuses to insert an icon it cannot get, with a note', async () => {
    const plugin = load(SVELTE);
    await plugin.settle();
    plugin.cdn.offline = true;
    await plugin.control(QUERY, 'anchor');
    await plugin.control(CHOSEN, 'beaker');
    await plugin.control(INSERT, true);

    expect(plugin.proposals).toEqual([]);
    expect(plugin.notes).toEqual([OFFLINE_NOTE]);
  });
});

describe('inserting without an icon package', () => {
  it('inserts the outline style as an inline svg component with the stroke on the svg', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);
    const op = insertOp(plugin);

    expect(plugin.proposals[0].label).toBe(LABEL);
    expect(op.component).toMatchObject({ name: 'CameraIcon', file: 'src/feega/icons/CameraIcon.svelte', attributes: '' });
    expect(op.component.source).toContain('viewBox="0 0 24 24"');
    expect(op.component.source).toContain('stroke-width="1.5"');
    expect(op.component.source).toContain('stroke={color}');
  });

  it('gives each style its own file and fills the solid style', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(STYLE, 'solid');
    await plugin.control(INSERT, true);
    const op = insertOp(plugin);

    expect(op.component).toMatchObject({ name: 'CameraSolidIcon', file: 'src/feega/icons/CameraSolidIcon.svelte' });
    expect(op.component.source).toContain('fill={color}');
  });

  it('draws the mini style on a 20 grid and the micro style on a 16 grid', async () => {
    const mini = load(SVELTE);
    await choose(mini, 'camera', 'camera');
    await mini.control(STYLE, 'mini');
    await mini.control(INSERT, true);
    const micro = load(SVELTE);
    await choose(micro, 'camera', 'camera');
    await micro.control(STYLE, 'micro');
    await micro.control(INSERT, true);

    expect(insertOp(mini).component.source).toContain('viewBox="0 0 20 20"');
    expect(insertOp(micro).component.source).toContain('viewBox="0 0 16 16"');
  });

  it('writes size and colour on the tag when they differ', async () => {
    const plugin = load(SVELTE);
    await choose(plugin, 'camera', 'camera');
    await plugin.control(SIZE, 32);
    await plugin.control(INHERIT, false);
    await plugin.control(COLOUR, '#ff0000');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component.attributes).toBe('size={32} color="#ff0000"');
  });
});

describe('inserting with the icon package the project already has', () => {
  it('re-exports the heroicons react component of the chosen style and sizes it with width and height', async () => {
    const plugin = load(at('src/App.tsx'), { ...PLAIN, packages: { '@heroicons/react': '^2.2.0' } });
    await choose(plugin, 'camera', 'camera');
    await plugin.control(STYLE, 'mini');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component).toMatchObject({
      name: 'CameraMiniIcon',
      file: 'src/feega/icons/CameraMiniIcon.tsx',
      source: "export { CameraIcon as default } from '@heroicons/react/20/solid';\n",
      attributes: 'width={24} height={24}'
    });
  });

  it('wraps the heroicons vue component', async () => {
    const plugin = load(at('src/App.vue'), { ...PLAIN, packages: { '@heroicons/vue': '^2.2.0' } });
    await choose(plugin, 'arrow-right', 'arrow-right');
    await plugin.control(INSERT, true);
    const op = insertOp(plugin);

    expect(op.component.source).toContain("import { ArrowRightIcon } from '@heroicons/vue/24/outline';");
    expect(op.component.source).toContain('<ArrowRightIcon />');
    expect(op.component.attributes).toBe(':width="24" :height="24"');
  });

  it('uses inline svg in a framework the installed package does not serve', async () => {
    const plugin = load(SVELTE, { ...PLAIN, packages: { '@heroicons/react': '^2.2.0' } });
    await choose(plugin, 'camera', 'camera');
    await plugin.control(INSERT, true);

    expect(insertOp(plugin).component.source).toContain('<svg');
  });
});
