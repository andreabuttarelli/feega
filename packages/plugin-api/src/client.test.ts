import { describe, expect, it } from 'vitest';
import { createApi, type Port } from './client';
import { createPluginHost, type EditorPort } from './host';
import { parseManifest } from './manifest';
import { Control, HandlePhase, OpKind, Place, type HostMessage, type PluginMessage, type Proposal, type Selection } from './protocol';

const SELECTION: Selection = { source: { file: 'a.svelte', line: 1, col: 1 }, component: null, tag: 'div', name: 'div', classes: '', rect: { x: 0, y: 0, width: 10, height: 10 }, styles: {}, attributes: [] };

function wire(permissions: string[], contributions: Record<string, unknown>) {
  const parsed = parseManifest({ id: 'acme.wired', name: 'Wired', version: '1.0.0', permissions, contributions });
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  let toHost: (m: PluginMessage) => void = () => undefined;
  let toPlugin: (m: HostMessage) => void = () => undefined;
  const port: Port = { post: (m) => queueMicrotask(() => toHost(m)), listen: (h) => (toPlugin = h) };
  const proposals: Proposal[] = [];
  const editor: EditorPort = {
    selection: () => SELECTION,
    project: async () => ({ typescript: false, publicDir: 'public' }),
    sourceText: async () => 'text',
    propose: async (p) => (proposals.push(p), { ok: true }),
    preview: () => undefined,
    fetch: async () => ({ status: 200, text: '' }),
    pickFile: async () => null,
    notify: () => undefined
  };
  const host = createPluginHost({
    editor,
    sandbox: () => ({ post: (m) => queueMicrotask(() => toPlugin(m)), listen: (h) => (toHost = h), close: () => undefined })
  });
  host.load(parsed.manifest, '');
  return { api: createApi(port), host, proposals };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('plugin api against the host', () => {
  it('reads the selection and the project', async () => {
    const { api } = wire(['selection', 'project', 'source'], {});
    expect(await api.selection.get()).toEqual(SELECTION);
    expect(await api.project.info()).toEqual({ typescript: false, publicDir: 'public' });
    expect(await api.source.text()).toBe('text');
  });

  it('rejects a call the manifest does not allow', async () => {
    const { api } = wire([], {});
    await expect(api.selection.get()).rejects.toThrow(/selection/);
  });

  it('proposes edits and gets the outcome', async () => {
    const { api, proposals } = wire(['edit.style'], {});
    const out = await api.propose('Mesh', [{ kind: OpKind.Style, at: 'a:1:1', css: { color: 'red' } }]);
    expect(out).toEqual({ ok: true });
    expect(proposals[0].label).toBe('Mesh');
  });

  it('reports a refused proposal as an outcome, not a throw', async () => {
    const { api } = wire([], {});
    const out = await api.propose('x', [{ kind: OpKind.Insert, at: 'a:1:1', place: Place.Child, component: { name: 'A', file: 'a.svelte', source: '' } }]);
    expect(out.ok).toBe(false);
  });

  it('delivers selection changes', async () => {
    const { api, host } = wire(['selection'], {});
    const seen: (Selection | null)[] = [];
    api.selection.on((s) => seen.push(s));
    host.selectionChanged(SELECTION);
    host.selectionChanged(null);
    await tick();
    expect(seen).toEqual([SELECTION, null]);
  });

  it('watches the selection: the current one first, then changes, never the stale read over a newer change', async () => {
    const { api, host } = wire(['selection'], {});
    const seen: (Selection | null)[] = [];
    api.selection.watch((s) => seen.push(s));
    host.selectionChanged(null);
    await tick();
    expect(seen).toEqual([null]);
    const later = wire(['selection'], {});
    const first: (Selection | null)[] = [];
    later.api.selection.watch((s) => first.push(s));
    await tick();
    expect(first).toEqual([SELECTION]);
  });

  it('renders a section and receives its control events', async () => {
    const { api, host } = wire([], { rightBar: [{ id: 'main', title: 'Main' }] });
    const section = api.section('main');
    const heard: [string, unknown][] = [];
    section.on((id, value) => heard.push([id, value]));
    await section.render([{ type: Control.Slider, id: 'size', label: 'Size', min: 0, max: 10, step: 1, value: 3 }]);
    expect(host.ui('acme.wired', 'main')).toHaveLength(1);
    host.control('acme.wired', 'main', 'size', 7);
    host.control('acme.wired', 'other', 'size', 9);
    await tick();
    expect(heard).toEqual([['size', 7]]);
  });

  it('draws overlay handles and receives drags', async () => {
    const { api, host } = wire([], { overlay: [{ id: 'ov' }] });
    const overlay = api.overlay('ov');
    const heard: unknown[] = [];
    overlay.on((id, phase, x, y) => heard.push([id, phase, x, y]));
    await overlay.render([{ id: 'p', x: 0.1, y: 0.2, color: '#fff', selected: false }]);
    host.handle('acme.wired', 'ov', 'p', HandlePhase.Move, 0.4, 0.5);
    await tick();
    expect(host.handles('acme.wired', 'ov')).toHaveLength(1);
    expect(heard).toEqual([['p', HandlePhase.Move, 0.4, 0.5]]);
  });

  it('runs menu and command handlers', async () => {
    const { api, host } = wire([], {});
    const heard: string[] = [];
    api.menu.on((item, _target, place) => heard.push(`menu:${item}:${place}`));
    api.command.on((command) => heard.push(`command:${command}`));
    api.action.on((action) => heard.push(`action:${action}`));
    host.menu('acme.wired', 'cube', null, Place.After);
    host.command('acme.wired', 'go');
    host.action('acme.wired', 'bar');
    await tick();
    expect(heard).toEqual(['menu:cube:after', 'command:go', 'action:bar']);
  });
});
