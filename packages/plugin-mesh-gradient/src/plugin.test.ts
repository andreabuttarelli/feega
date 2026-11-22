import { describe, expect, it } from 'vitest';
import { createApi, type Port } from '@feega/plugin-api/client';
import { createPluginHost, type EditorPort } from '@feega/plugin-api/host';
import { parseManifest } from '@feega/plugin-api/manifest';
import { Control, HandlePhase, OpKind, type Css, type HostMessage, type PluginMessage, type Proposal, type Selection, type UiNode } from '@feega/plugin-api/protocol';
import manifest from '../feega-plugin.json';
import { cssOf, DEFAULT_MESH } from './mesh';
import { ADD, BASE, COLOUR, POINTS_LIST, RANDOMIZE, REMOVE, SOFTNESS } from './mesh';
import { meshPlugin, SECTION, OVERLAY, START } from './plugin';

const PLAIN: Selection = { source: { file: 'src/Hero.svelte', line: 4, col: 3 }, component: null, tag: 'section', name: 'section', classes: 'hero', rect: { x: 0, y: 0, width: 400, height: 200 }, styles: { 'background-image': 'none', 'background-color': 'rgba(0, 0, 0, 0)' }, attributes: [] };
const AT = 'src/Hero.svelte:4:3';
const MESHED: Selection = { ...PLAIN, styles: { ...cssOf(DEFAULT_MESH) } };

function load(initial: Selection | null) {
  const parsed = parseManifest({ ...manifest, permissions: manifest.permissions });
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  let selection = initial;
  const proposals: Proposal[] = [];
  const previews: { at: string; css: Css | null }[] = [];
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const editor: EditorPort = {
    selection: () => selection,
    project: async () => ({ typescript: true, publicDir: 'public' }),
    sourceText: async () => null,
    propose: async (p) => (proposals.push(p), { ok: true }),
    preview: (at, css) => previews.push({ at, css }),
    fetch: async () => ({ status: 200, text: '' }),
    pickFile: async () => null,
    notify: () => undefined
  };
  const host = createPluginHost({
    editor,
    sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined })
  });
  host.load(parsed.manifest, '');
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  let n = 0;
  meshPlugin(createApi(port), () => ((n += 0.173) % 1));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
  const select = async (next: Selection | null) => {
    selection = next;
    host.selectionChanged(next);
    await settle();
  };
  const ui = () => host.ui(parsed.manifest.id, SECTION);
  const handles = () => host.handles(parsed.manifest.id, OVERLAY);
  const control = async (id: string, value: string | number | boolean, live = false) => {
    host.control(parsed.manifest.id, SECTION, id, value, live);
    await settle();
  };
  const handle = async (id: string, phase: HandlePhase, x: number, y: number) => {
    host.handle(parsed.manifest.id, OVERLAY, id, phase, x, y);
    await settle();
  };
  return { settle, select, ui, handles, control, handle, proposals, previews, manifest: parsed.manifest };
}

const node = <T extends UiNode['type']>(tree: UiNode[], type: T, id?: string) => tree.find((n) => n.type === type && (id === undefined || ('id' in n && n.id === id)));

describe('manifest', () => {
  it('declares one right-bar section and one overlay, and asks only for what it uses', () => {
    const { manifest: m } = load(null);
    expect(m.contributions.rightBar).toEqual([{ id: SECTION, title: 'Mesh gradient', when: ['!attribute:data-feega-scene'] }]);
    expect(m.contributions.overlay).toEqual([{ id: OVERLAY, when: ['!attribute:data-feega-scene'] }]);
    expect([...m.grants].sort()).toEqual(['edit.style', 'selection']);
    expect(m.hosts).toEqual([]);
  });
});

describe('mesh gradient plugin', () => {
  it('offers to start a mesh on an element that has none, and shows no handles', async () => {
    const plugin = load(PLAIN);
    await plugin.settle();
    expect(node(plugin.ui(), Control.Button, START)).toBeTruthy();
    expect(plugin.handles()).toEqual([]);
  });

  it('shows nothing without a selection', async () => {
    const plugin = load(null);
    await plugin.settle();
    expect(plugin.ui()).toEqual([]);
    expect(plugin.handles()).toEqual([]);
  });

  it('writes pure CSS to the element source when the mesh is started', async () => {
    const plugin = load(PLAIN);
    await plugin.settle();
    await plugin.control(START, true);
    expect(plugin.proposals).toHaveLength(1);
    expect(plugin.proposals[0].label).toBe('Mesh gradient');
    expect(plugin.proposals[0].ops).toEqual([{ kind: OpKind.Style, at: AT, css: cssOf(DEFAULT_MESH) }]);
    expect(plugin.handles()).toHaveLength(DEFAULT_MESH.points.length);
    expect(node(plugin.ui(), Control.List, POINTS_LIST)).toBeTruthy();
  });

  it('reads a mesh that is already on the element', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    expect(plugin.handles().map((h) => h.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(plugin.proposals).toEqual([]);
  });

  it('previews a colour while it is live and writes it when committed', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.control(COLOUR, '#00ff00', true);
    expect(plugin.previews.at(-1)?.at).toBe(AT);
    expect(plugin.previews.at(-1)?.css?.['background-image']).toContain('#00ff00 0%');
    expect(plugin.proposals).toEqual([]);
    await plugin.control(COLOUR, '#00ff00');
    expect(plugin.proposals).toHaveLength(1);
    expect(JSON.stringify(plugin.proposals[0].ops)).toContain('#00ff00 0%');
  });

  it('changes softness the same way', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.control(SOFTNESS, 100, true);
    expect(plugin.previews.at(-1)?.css?.['background-image']).toContain('00 100%');
    await plugin.control(SOFTNESS, 100);
    expect(plugin.proposals).toHaveLength(1);
  });

  it('changes the base colour', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.control(BASE, '#ffffff');
    expect(plugin.proposals[0].ops[0]).toMatchObject({ css: { 'background-color': '#ffffff' } });
  });

  it('selects a point from the list without writing', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.control(POINTS_LIST, 'p3');
    expect(plugin.proposals).toEqual([]);
    expect(node(plugin.ui(), Control.Colour, COLOUR)).toMatchObject({ value: DEFAULT_MESH.points[2].color });
    expect(plugin.handles().find((h) => h.selected)?.id).toBe('p3');
  });

  it('adds, removes and randomizes points, writing each', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.control(ADD, true);
    expect(plugin.handles()).toHaveLength(5);
    await plugin.control(REMOVE, true);
    expect(plugin.handles()).toHaveLength(4);
    await plugin.control(RANDOMIZE, true);
    expect(plugin.proposals).toHaveLength(3);
  });

  it('drags a point: previews while moving, writes on release', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.handle('p2', HandlePhase.Press, 0.85, 0.15);
    await plugin.handle('p2', HandlePhase.Move, 0.5, 0.5);
    expect(plugin.previews.at(-1)?.css?.['background-image']).toContain('circle at 50% 50%');
    expect(plugin.proposals).toEqual([]);
    expect(plugin.handles().find((h) => h.id === 'p2')).toMatchObject({ x: 0.5, y: 0.5, selected: true });
    await plugin.handle('p2', HandlePhase.Release, 0.5, 0.5);
    expect(plugin.proposals).toHaveLength(1);
    expect(JSON.stringify(plugin.proposals[0].ops)).toContain('circle at 50% 50%');
  });

  it('keeps the chosen point when the same element is read again', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.control(POINTS_LIST, 'p3');
    await plugin.select({ ...MESHED, rect: { ...MESHED.rect, width: 401 } });
    expect(plugin.handles().find((h) => h.selected)?.id).toBe('p3');
  });

  it('forgets the chosen point when another element is picked', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.control(POINTS_LIST, 'p3');
    await plugin.select({ ...MESHED, source: { file: 'src/Other.svelte', line: 1, col: 1 } });
    expect(plugin.handles().find((h) => h.selected)?.id).toBe('p1');
  });

  it('forgets the mesh when another element is picked', async () => {
    const plugin = load(MESHED);
    await plugin.settle();
    await plugin.select(PLAIN);
    expect(plugin.handles()).toEqual([]);
    expect(node(plugin.ui(), Control.Button, START)).toBeTruthy();
  });
});
