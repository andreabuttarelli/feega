import { describe, expect, it } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, type HostMessage, type PluginMessage, type Proposal, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import manifest from '../feega-plugin.json';
import { BAR, CLEAR, ITEM, KIND, LABEL, PICK, SECTION, gradientsPlugin } from './plugin';
import { PRESETS } from './presets';

const SELECTION: Selection = { source: { file: 'src/Hero.svelte', line: 4, col: 3 }, component: null, tag: 'section', name: 'section', classes: '', rect: { x: 0, y: 0, width: 1, height: 1 }, styles: {}, attributes: [] };
const AT = 'src/Hero.svelte:4:3';

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
    project: async () => ({ typescript: true, publicDir: 'public', packages: {} }),
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
  gradientsPlugin(createApi(port));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const ui = () => host.ui(parsed.manifest.id, SECTION);
  const barUi = () => host.ui(parsed.manifest.id, BAR);
  const control = async (id: string, value: string | number | boolean, section = SECTION) => {
    host.control(parsed.manifest.id, section, id, value);
    await settle();
  };
  const open = async (at: Selection | null = SELECTION) => {
    host.menu(parsed.manifest.id, ITEM, at?.source ?? null);
    await settle();
  };
  return { settle, ui, barUi, control, open, proposals, manifest: parsed.manifest };
}

const node = <T extends UiNode['type']>(tree: UiNode[], type: T, id?: string) => tree.find((n) => n.type === type && (id === undefined || ('id' in n && n.id === id)));

const items = (tree: UiNode[]) => {
  const grid = node(tree, Control.Grid, PICK);
  return grid?.type === Control.Grid ? grid.items : [];
};

describe('manifest', () => {
  it('adds the presets from the Add menu, shows its Properties section only on an element that has a gradient, and asks only to read the selection and change styles', () => {
    const { manifest: m } = load(null);

    expect(m.contributions.addMenu).toEqual([{ id: ITEM, title: 'Gradient preset', popover: SECTION }]);
    expect(m.contributions.popover).toEqual([{ id: SECTION, title: 'Gradient presets' }]);
    expect(m.contributions.rightBar).toEqual([{ id: BAR, title: 'Gradient', when: ['owned'] }]);
    expect(m.owns).toEqual(['style:background-image*=gradient(']);
    expect([...m.grants].sort()).toEqual(['edit.style', 'selection']);
    expect(m.hosts).toEqual([]);
  });
});

describe('gradient presets plugin', () => {
  it('shows nothing until the menu entry is picked', async () => {
    const plugin = load(SELECTION);
    await plugin.settle();

    expect(plugin.ui()).toEqual([]);
  });

  it('shows every preset as a swatch of its own gradient', async () => {
    const plugin = load(SELECTION);
    await plugin.open();

    expect(items(plugin.ui()).map((item) => item.swatch)).toEqual(PRESETS.map((preset) => preset.css));
  });

  it('narrows the gallery to one kind', async () => {
    const plugin = load(SELECTION);
    await plugin.open();
    await plugin.control(KIND, 'conic');

    expect(items(plugin.ui()).length).toBeGreaterThan(0);
    expect(items(plugin.ui()).every((item) => item.swatch?.startsWith('conic-gradient'))).toBe(true);
    expect(plugin.proposals).toEqual([]);
  });

  it('applies a picked preset to the element the menu was opened on, then closes', async () => {
    const plugin = load(SELECTION);
    await plugin.open();
    await plugin.control(PICK, PRESETS[3].id);

    expect(plugin.proposals).toHaveLength(1);
    expect(plugin.proposals[0].label).toBe(LABEL);
    expect(plugin.proposals[0].ops).toEqual([{ kind: OpKind.Style, at: AT, css: { 'background-image': PRESETS[3].css } }]);
    expect(plugin.ui()).toEqual([]);
  });

  it('offers only to remove the gradient in the Properties section, and clears it', async () => {
    const plugin = load(SELECTION);
    await plugin.settle();

    expect(plugin.barUi()).toEqual([{ type: Control.Button, id: CLEAR, label: 'Remove gradient' }]);

    await plugin.control(CLEAR, true, BAR);

    expect(plugin.proposals[0].ops).toEqual([{ kind: OpKind.Style, at: AT, css: { 'background-image': 'none' } }]);
  });

  it('keeps the Properties section empty without a selection', async () => {
    const plugin = load(null);
    await plugin.settle();

    expect(plugin.barUi()).toEqual([]);
  });
});
