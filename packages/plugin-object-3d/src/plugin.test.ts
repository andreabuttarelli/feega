import { describe, expect, it, vi } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, Place, type HostMessage, type Picked, type PluginMessage, type ProjectInfo, type Proposal, type Selection } from '@feega/plugin-api/protocol';
import manifest from '../feega-plugin.json';
import { COMPONENT_NAME, DEFAULT_SCENE, RUNTIME_FILE } from './scene';
import { FONT_FILE, SECTION, THREE_VERSION, objectPlugin } from './plugin';
import font from './runtime/inter_bold.typeface.json?raw';
import licence from './runtime/OFL.txt?raw';

const TARGET = { file: 'src/routes/+page.svelte', line: 5, col: 3 };

const PAGE_PICK: Selection = { source: { file: 'src/feega/Scene3D.svelte', line: 18, col: 1 }, component: { file: 'src/routes/+page.svelte', line: 5, col: 3 }, tag: 'div', name: 'div', classes: 'feega-scene', rect: { x: 0, y: 0, width: 400, height: 360 }, styles: {}, attributes: [{ name: 'data-feega-scene', value: 'cube' }, { name: 'data-material', value: 'glass' }, { name: 'data-lights', value: 'studio' }, { name: 'data-autorotate', value: 'true' }, { name: 'data-follow', value: 'true' }, { name: 'data-color', value: '#ff5a1f' }] };

function load(options: { info?: Partial<ProjectInfo>; picked?: Picked | null; selection?: Selection | null; font?: { status: number; text: string } } = {}) {
  const parsed = parseManifest(manifest);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  const proposals: Proposal[] = [];
  const notices: string[] = [];
  const fetched: string[] = [];
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => options.selection ?? null,
    project: async () => ({ typescript: true, publicDir: 'public', ...options.info }),
    sourceText: async () => null,
    propose: async (p) => (proposals.push(p), { ok: true }),
    preview: () => undefined,
    fetch: async (url) => (fetched.push(url), options.font ?? { status: 200, text: '{"glyphs":{}}' }),
    pickFile: vi.fn(async () => (options.picked === undefined ? { name: 'Robot Arm.glb', base64: 'Z2xURg==' } : options.picked)),
    notify: (text) => notices.push(text)
  };
  const host = createPluginHost({ editor, sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined }) });
  host.load(parsed.manifest, '');
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  objectPlugin(createApi(port));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
  const id = parsed.manifest.id;
  return {
    proposals,
    notices,
    fetched,
    editor,
    settle,
    ui: () => host.ui(id, SECTION),
    insert: async (item: string, target = TARGET, place: Place | null = null) => (host.menu(id, item, target, place), settle()),
    control: async (control: string, value: string | boolean) => (host.control(id, SECTION, control, value), settle()),
    select: async (next: Selection | null) => (host.selectionChanged(next), settle())
  };
}

const kinds = (proposal: Proposal) => proposal.ops.map((op) => op.kind);

describe('manifest', () => {
  it('has an add-menu category with every shape and one section, and asks for no network', () => {
    const parsed = parseManifest(manifest);
    expect(parsed.ok && parsed.manifest.contributions.addMenu?.map((e) => e.category)).toEqual(Array(5).fill('3D object'));
    expect(parsed.ok && parsed.manifest.hosts).toEqual([]);
    expect(parsed.ok && parsed.manifest.contributions.rightBar?.[0].when).toEqual(['attribute:data-feega-scene']);
  });
});

describe('inserting a shape', () => {
  it('adds the dependency, the component and the runtime in one proposal', async () => {
    const plugin = load();
    await plugin.insert('shape:cube');
    expect(plugin.proposals).toHaveLength(1);
    const [proposal] = plugin.proposals;
    expect(proposal.label).toBe('3D object');
    expect(kinds(proposal)).toEqual([OpKind.Dependency, OpKind.Dependency, OpKind.Insert]);
    expect(proposal.ops[0]).toEqual({ kind: OpKind.Dependency, name: 'three', version: THREE_VERSION });
    expect(proposal.ops[1]).toEqual({ kind: OpKind.Dependency, name: '@types/three', version: THREE_VERSION, dev: true });
    const insert = proposal.ops[2];
    expect(insert).toMatchObject({ kind: OpKind.Insert, at: 'src/routes/+page.svelte:5:3', place: Place.Auto, component: { name: COMPONENT_NAME, file: 'src/feega/Scene3D.svelte', attributes: expect.stringContaining('shape="cube"') }, support: [{ file: RUNTIME_FILE }] });
  });

  it('skips the type package in a javascript project and picks the jsx component for react', async () => {
    const plugin = load({ info: { typescript: false } });
    await plugin.insert('shape:sphere', { file: 'src/App.jsx', line: 3, col: 5 });
    const [proposal] = plugin.proposals;
    expect(kinds(proposal)).toEqual([OpKind.Dependency, OpKind.Insert]);
    expect(proposal.ops[1]).toMatchObject({ component: { file: 'src/feega/Scene3D.jsx' } });
  });

  it.each([
    ['src/App.tsx', 'src/feega/Scene3D.tsx'],
    ['src/App.vue', 'src/feega/Scene3D.vue'],
    ['src/pages/index.astro', 'src/feega/Scene3D.astro'],
    ['src/routes/+page.svelte', 'src/feega/Scene3D.svelte']
  ])('uses the framework of %s', async (file, component) => {
    const plugin = load();
    await plugin.insert('shape:torus', { file, line: 1, col: 1 });
    expect(plugin.proposals[0].ops.at(-1)).toMatchObject({ component: { file: component } });
  });

  it('passes the place the menu asked for', async () => {
    const plugin = load();
    await plugin.insert('shape:cube', TARGET, Place.After);
    expect(plugin.proposals[0].ops.at(-1)).toMatchObject({ place: Place.After });
  });

  it('tells the user when the file is not a component file, and writes nothing', async () => {
    const plugin = load();
    await plugin.insert('shape:cube', { file: 'index.html', line: 1, col: 1 });
    expect(plugin.proposals).toEqual([]);
    expect(plugin.notices[0]).toMatch(/Svelte|React|Vue|Astro/);
  });

  it('does nothing without a target', async () => {
    const plugin = load();
    await plugin.insert('shape:cube', null as never);
    expect(plugin.proposals).toEqual([]);
  });

  it('ignores a menu item that is not its own', async () => {
    const plugin = load();
    await plugin.insert('shape:pyramid');
    expect(plugin.proposals).toEqual([]);
  });
});

describe('3D text', () => {
  it('adds the bundled font as an asset the component points at, with no network', async () => {
    const plugin = load();
    await plugin.insert('shape:text');
    expect(plugin.fetched).toEqual([]);
    const ops = plugin.proposals[0].ops;
    expect(ops.filter((op) => op.kind === OpKind.Asset)).toEqual([
      { kind: OpKind.Asset, file: 'public/feega/fonts/inter_bold.typeface.json', base64: Buffer.from(font).toString('base64') },
      { kind: OpKind.Asset, file: 'public/feega/fonts/OFL.txt', base64: Buffer.from(licence).toString('base64') }
    ]);
    expect(ops.at(-1)).toMatchObject({ component: { attributes: expect.stringContaining('font="/feega/fonts/inter_bold.typeface.json"') } });
  });

  it('ships a font under the SIL OFL with no reserved name, under 150 KB', () => {
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(licence).not.toMatch(/with Reserved Font Name/);
    expect(Buffer.byteLength(font)).toBeLessThan(150 * 1024);
    expect(JSON.parse(font).glyphs['A'].o).toBeTruthy();
  });

});

describe('model', () => {
  it('copies the picked file through the asset operation and points the component at it', async () => {
    const plugin = load();
    await plugin.insert('shape:model');
    expect(plugin.editor.pickFile).toHaveBeenCalledWith(['.glb', '.gltf']);
    const ops = plugin.proposals[0].ops;
    expect(ops.find((op) => op.kind === OpKind.Asset)).toEqual({ kind: OpKind.Asset, file: 'public/feega/models/robot-arm.glb', base64: 'Z2xURg==' });
    expect(ops.at(-1)).toMatchObject({ component: { attributes: expect.stringContaining('model="/feega/models/robot-arm.glb"') } });
  });

  it('uses the static folder when the project serves from there', async () => {
    const plugin = load({ info: { publicDir: 'static' } });
    await plugin.insert('shape:model');
    expect(plugin.proposals[0].ops.find((op) => op.kind === OpKind.Asset)).toMatchObject({ file: 'static/feega/models/robot-arm.glb' });
  });

  it('writes nothing when the user cancels the file dialog', async () => {
    const plugin = load({ picked: null });
    await plugin.insert('shape:model');
    expect(plugin.proposals).toEqual([]);
  });
});

describe('right-bar controls', () => {
  it('shows nothing for an element that is not a 3D scene', async () => {
    const plugin = load({ selection: { ...PAGE_PICK, attributes: [] } });
    await plugin.settle();
    expect(plugin.ui()).toEqual([]);
  });

  it('shows material, lights, auto-rotate, mouse follow, height and colour for a scene', async () => {
    const plugin = load({ selection: PAGE_PICK });
    await plugin.settle();
    const tree = plugin.ui();
    expect(tree.map((n) => ('id' in n ? n.id : n.type))).toEqual(['material', 'lights', 'autorotate', 'follow', 'height', 'color']);
    expect(tree[0]).toMatchObject({ type: Control.Select, value: 'glass', options: [{ value: 'glass' }, { value: 'metal' }, { value: 'matte' }] });
    expect(tree[2]).toMatchObject({ type: Control.Toggle, value: true });
  });

  it('writes a change to the usage of the component, not to the element inside it', async () => {
    const plugin = load({ selection: PAGE_PICK });
    await plugin.settle();
    await plugin.control('material', 'metal');
    expect(plugin.proposals).toHaveLength(1);
    expect(plugin.proposals[0].ops).toEqual([{ kind: OpKind.Attributes, at: 'src/routes/+page.svelte:5:3', tag: COMPONENT_NAME, set: { material: 'metal' } }]);
  });

  it('writes toggles as true or false text', async () => {
    const plugin = load({ selection: PAGE_PICK });
    await plugin.settle();
    await plugin.control('autorotate', false);
    await plugin.control('follow', false);
    expect(plugin.proposals.map((p) => p.ops[0])).toEqual([
      expect.objectContaining({ set: { autorotate: 'false' } }),
      expect.objectContaining({ set: { follow: 'false' } })
    ]);
  });

  it('writes the height as pixels, and nothing for automatic', async () => {
    const plugin = load({ selection: PAGE_PICK });
    await plugin.settle();
    expect(plugin.ui().find((n) => 'id' in n && n.id === 'height')).toMatchObject({ type: Control.Slider, value: 0 });
    await plugin.control('height', 420);
    await plugin.control('height', 0);
    expect(plugin.proposals.map((p) => p.ops[0])).toEqual([expect.objectContaining({ set: { height: '420' } }), expect.objectContaining({ set: { height: '' } })]);
  });

  it('leaves the element out of the proposal when the usage is at the root of its file', async () => {
    const plugin = load({ selection: { ...PAGE_PICK, component: null } });
    await plugin.settle();
    await plugin.control('material', 'matte');
    expect(plugin.proposals[0].ops[0]).toEqual({ kind: OpKind.Attributes, tag: COMPONENT_NAME, set: { material: 'matte' } });
  });

  it('shows the new value right away', async () => {
    const plugin = load({ selection: PAGE_PICK });
    await plugin.settle();
    await plugin.control('lights', 'dramatic');
    expect(plugin.ui()[1]).toMatchObject({ id: 'lights', value: 'dramatic' });
  });

  it('says models keep their own materials', async () => {
    const model = { ...PAGE_PICK, attributes: PAGE_PICK.attributes.map((a) => (a.name === 'data-feega-scene' ? { ...a, value: 'model' } : a)) };
    const plugin = load({ selection: model });
    await plugin.settle();
    expect(plugin.ui().some((n) => n.type === Control.Note)).toBe(true);
    expect(plugin.ui().some((n) => 'id' in n && n.id === 'material')).toBe(false);
  });

  it('follows the selection', async () => {
    const plugin = load({ selection: null });
    await plugin.select(PAGE_PICK);
    expect(plugin.ui()).toHaveLength(6);
    await plugin.select(null);
    expect(plugin.ui()).toEqual([]);
  });

  it('defaults are sane', () => {
    expect(DEFAULT_SCENE.material).toBe('glass');
  });
});
