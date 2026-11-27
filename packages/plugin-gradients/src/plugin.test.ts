import { describe, expect, it } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, OpKind, type HostMessage, type PluginMessage, type Proposal, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import manifest from '../feega-plugin.json';
import { CLEAR, KIND, LABEL, PICK, SECTION, gradientsPlugin } from './plugin';
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
  const control = async (id: string, value: string | number | boolean) => {
    host.control(parsed.manifest.id, SECTION, id, value);
    await settle();
  };
  return { settle, ui, control, proposals, manifest: parsed.manifest };
}

const node = <T extends UiNode['type']>(tree: UiNode[], type: T, id?: string) => tree.find((n) => n.type === type && (id === undefined || ('id' in n && n.id === id)));

const items = (tree: UiNode[]) => {
  const grid = node(tree, Control.Grid, PICK);
  return grid?.type === Control.Grid ? grid.items : [];
};

describe('manifest', () => {
  it('declares one Properties section shown on a selection and asks only to read it and change styles', () => {
    const { manifest: m } = load(null);

    expect(m.contributions.rightBar).toEqual([{ id: SECTION, title: 'Gradient presets', when: ['selection'] }]);
    expect([...m.grants].sort()).toEqual(['edit.style', 'selection']);
    expect(m.hosts).toEqual([]);
  });
});

describe('gradient presets plugin', () => {
  it('shows nothing without a selection', async () => {
    const plugin = load(null);
    await plugin.settle();

    expect(plugin.ui()).toEqual([]);
  });

  it('shows every preset as a swatch of its own gradient', async () => {
    const plugin = load(SELECTION);
    await plugin.settle();

    expect(items(plugin.ui()).map((item) => item.swatch)).toEqual(PRESETS.map((preset) => preset.css));
  });

  it('narrows the gallery to one kind', async () => {
    const plugin = load(SELECTION);
    await plugin.settle();
    await plugin.control(KIND, 'conic');

    expect(items(plugin.ui()).length).toBeGreaterThan(0);
    expect(items(plugin.ui()).every((item) => item.swatch?.startsWith('conic-gradient'))).toBe(true);
    expect(plugin.proposals).toEqual([]);
  });

  it('applies a preset as the background image of the selected element', async () => {
    const plugin = load(SELECTION);
    await plugin.settle();
    await plugin.control(PICK, PRESETS[3].id);

    expect(plugin.proposals).toHaveLength(1);
    expect(plugin.proposals[0].label).toBe(LABEL);
    expect(plugin.proposals[0].ops).toEqual([{ kind: OpKind.Style, at: AT, css: { 'background-image': PRESETS[3].css } }]);
  });

  it('marks the preset that was applied', async () => {
    const plugin = load(SELECTION);
    await plugin.settle();
    await plugin.control(PICK, PRESETS[3].id);
    const grid = node(plugin.ui(), Control.Grid, PICK);

    expect(grid?.type === Control.Grid && grid.selected).toBe(PRESETS[3].id);
  });

  it('clears the gradient', async () => {
    const plugin = load(SELECTION);
    await plugin.settle();
    await plugin.control(CLEAR, true);

    expect(plugin.proposals[0].ops).toEqual([{ kind: OpKind.Style, at: AT, css: { 'background-image': 'none' } }]);
  });
});
