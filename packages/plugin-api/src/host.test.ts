import { describe, expect, it, vi } from 'vitest';
import { createPluginHost, type Channel, type EditorPort } from './host';
import { Point, parseManifest, type Manifest } from './manifest';
import { Call, Control, HandlePhase, OpKind, Place, Signal, type HostMessage, type Outcome, type PluginMessage, type Proposal, type Selection } from './protocol';

const SELECTION: Selection = {
  source: { file: 'src/App.svelte', line: 3, col: 1 },
  component: null,
  tag: 'div',
  name: 'div',
  classes: '',
  rect: { x: 0, y: 0, width: 100, height: 50 },
  styles: { color: 'red' },
  attributes: []
};

const manifestOf = (permissions: string[], contributions: Record<string, unknown> = {}): Manifest => {
  const out = parseManifest({ id: 'acme.test', name: 'Test', version: '1.0.0', permissions, contributions });
  if (!out.ok) {
    throw new Error(out.reason);
  }
  return out.manifest;
};

function fakeChannel() {
  const sent: HostMessage[] = [];
  let handler: (message: PluginMessage) => void = () => undefined;
  let closed = false;
  const channel: Channel = { post: (m) => sent.push(m), listen: (h) => (handler = h), close: () => (closed = true) };
  return { channel, sent, closed: () => closed, emit: (message: unknown) => handler(message as PluginMessage) };
}

function setup(permissions: string[], contributions: Record<string, unknown> = {}, selection: Selection | null = SELECTION) {
  const plugin = fakeChannel();
  const proposals: Proposal[] = [];
  const editor: EditorPort = {
    selection: () => selection,
    project: async () => ({ typescript: true, publicDir: 'public' }),
    sourceText: async () => 'source',
    propose: async (p): Promise<Outcome> => (proposals.push(p), { ok: true }),
    preview: vi.fn(),
    fetch: vi.fn(async () => ({ status: 200, text: 'body' })),
    pickFile: vi.fn(async () => ({ name: 'a.glb', base64: 'AA==' })),
    notify: vi.fn()
  };
  const host = createPluginHost({ sandbox: () => plugin.channel, editor });
  host.load(manifestOf(permissions, contributions), 'code');
  const call = async (call: Call, args?: unknown) => {
    const before = plugin.sent.length;
    plugin.emit({ type: 'call', id: before + 1, call, args });
    await new Promise((resolve) => setTimeout(resolve, 0));
    return plugin.sent.at(-1) as Extract<HostMessage, { type: 'result' }>;
  };
  return { host, plugin, editor, proposals, call };
}

const style = { kind: OpKind.Style, at: 'a:1:1', css: { color: 'red' } } as const;

describe('loading', () => {
  it('refuses a manifest that does not validate', () => {
    const host = createPluginHost({ sandbox: () => fakeChannel().channel, editor: setup([]).editor });
    const out = host.load({ id: 'x' } as unknown as Manifest, 'code');
    expect(out.ok).toBe(false);
  });

  it('lists contributions by point with their plugin', () => {
    const { host } = setup([], { command: [{ id: 'go', title: 'Go' }], rightBar: [{ id: 'main', title: 'Main' }] });
    expect(host.contributions(Point.Command)).toEqual([{ plugin: 'acme.test', entry: { id: 'go', title: 'Go' }, owns: [] }]);
    expect(host.contributions(Point.RightBar)).toHaveLength(1);
    expect(host.contributions(Point.AddMenu)).toEqual([]);
  });

  it('refuses a second plugin with the same id', () => {
    const { host } = setup([]);
    expect(host.load(manifestOf([]), 'code').ok).toBe(false);
  });

  it('closes the sandbox and drops contributions on unload', () => {
    const { host, plugin } = setup([], { command: [{ id: 'go', title: 'Go' }] });
    host.unload('acme.test');
    expect(plugin.closed()).toBe(true);
    expect(host.contributions(Point.Command)).toEqual([]);
  });
});

describe('permissions', () => {
  it('answers a read the plugin may do', async () => {
    const { call } = setup(['selection']);
    expect(await call(Call.Selection)).toMatchObject({ ok: true, value: SELECTION });
  });

  it('refuses a read the plugin has no permission for', async () => {
    const { call } = setup([]);
    expect(await call(Call.Selection)).toMatchObject({ ok: false, reason: expect.stringContaining('selection') });
    expect(await call(Call.SourceText)).toMatchObject({ ok: false });
    expect(await call(Call.Project)).toMatchObject({ ok: false });
  });

  it('refuses the whole proposal when one operation is not permitted, and writes nothing', async () => {
    const { call, proposals } = setup(['edit.style']);
    const out = await call(Call.Propose, { label: 'x', ops: [style, { kind: OpKind.Dependency, name: 'three', version: '^0.180.0' }] });
    expect(out).toMatchObject({ ok: true, value: { ok: false, reason: expect.stringContaining('edit.dependency') } });
    expect(proposals).toEqual([]);
  });

  it.each([
    [OpKind.Style, 'edit.style', { kind: OpKind.Style, at: 'a:1:1', css: {} }],
    [OpKind.Attributes, 'edit.attributes', { kind: OpKind.Attributes, at: 'a:1:1', set: {} }],
    [OpKind.Insert, 'edit.insert', { kind: OpKind.Insert, at: 'a:1:1', place: Place.Child, component: { name: 'A', file: 'a.svelte', source: '' } }],
    [OpKind.Dependency, 'edit.dependency', { kind: OpKind.Dependency, name: 'a', version: '1.0.0' }],
    [OpKind.Asset, 'edit.asset', { kind: OpKind.Asset, file: 'public/a.bin', base64: '' }]
  ])('lets a %s operation through with %s', async (_kind, permission, op) => {
    const { call, proposals } = setup([permission]);
    expect(await call(Call.Propose, { label: 'ok', ops: [op] })).toMatchObject({ ok: true });
    expect(proposals).toHaveLength(1);
  });

  it('refuses a malformed proposal', async () => {
    const { call, proposals } = setup(['edit.style']);
    expect(await call(Call.Propose, { label: 'x', ops: [{ kind: 'format-disk' }] })).toMatchObject({ value: { ok: false } });
    expect(await call(Call.Propose, 'nonsense')).toMatchObject({ value: { ok: false } });
    expect(proposals).toEqual([]);
  });

  it('previews only with the style permission', async () => {
    const denied = setup([]);
    expect(await denied.call(Call.Preview, { at: 'a:1:1', css: { color: 'red' } })).toMatchObject({ ok: false });
    expect(denied.editor.preview).not.toHaveBeenCalled();
    const allowed = setup(['edit.style']);
    await allowed.call(Call.Preview, { at: 'a:1:1', css: { color: 'red' } });
    expect(allowed.editor.preview).toHaveBeenCalledWith('a:1:1', { color: 'red' });
  });

  it('fetches only from hosts the manifest names', async () => {
    const { call, editor } = setup(['network:api.example.com']);
    expect(await call(Call.Fetch, { url: 'https://api.example.com/v1' })).toMatchObject({ ok: true, value: { status: 200, text: 'body' } });
    expect(await call(Call.Fetch, { url: 'https://evil.example.org/' })).toMatchObject({ ok: false, reason: expect.stringContaining('evil.example.org') });
    expect(await call(Call.Fetch, { url: 'not a url' })).toMatchObject({ ok: false });
    expect(editor.fetch).toHaveBeenCalledTimes(1);
  });

  it('never fetches for a plugin with no hosts', async () => {
    const { call, editor } = setup([]);
    expect(await call(Call.Fetch, { url: 'https://api.example.com/' })).toMatchObject({ ok: false });
    expect(editor.fetch).not.toHaveBeenCalled();
  });

  it('picks a file only with the file permission', async () => {
    const denied = setup([]);
    expect(await denied.call(Call.PickFile, { accept: ['.glb'] })).toMatchObject({ ok: false, reason: expect.stringContaining('file.pick') });
    expect(denied.editor.pickFile).not.toHaveBeenCalled();
    const allowed = setup(['file.pick']);
    expect(await allowed.call(Call.PickFile, { accept: ['.glb'] })).toMatchObject({ ok: true, value: { name: 'a.glb' } });
    expect(allowed.editor.pickFile).toHaveBeenCalledWith(['.glb']);
  });

  it('lets any plugin show a notice', async () => {
    const { call, editor } = setup([]);
    expect(await call(Call.Notify, { text: 'hello' })).toMatchObject({ ok: true });
    expect(editor.notify).toHaveBeenCalledWith('hello');
  });

  it('ignores messages that are not calls', async () => {
    const { plugin } = setup(['selection']);
    plugin.emit({ type: 'call', id: 'x', call: Call.Selection });
    plugin.emit({ type: 'call', id: 1, call: 'rm -rf' });
    plugin.emit(null);
    expect(plugin.sent).toEqual([]);
  });
});

describe('contributions state', () => {
  const contributions = { rightBar: [{ id: 'main', title: 'Main' }], overlay: [{ id: 'ov' }] };
  const tree = [{ type: Control.Note, text: 'hi' }];

  it('keeps the tree a plugin rendered for its own right-bar section and notifies', async () => {
    const { host, call } = setup([], contributions);
    const seen = vi.fn();
    host.subscribe(seen);
    expect(await call(Call.Render, { contribution: 'main', tree })).toMatchObject({ ok: true });
    expect(host.ui('acme.test', 'main')).toEqual(tree);
    expect(seen).toHaveBeenCalled();
  });

  it('keeps the tree a plugin rendered for its popover', async () => {
    const { host, call } = setup([], { popover: [{ id: 'pick', title: 'Pick' }] });

    expect(await call(Call.Render, { contribution: 'pick', tree })).toMatchObject({ ok: true });
    expect(host.ui('acme.test', 'pick')).toEqual(tree);
  });

  it('refuses to render into a contribution it did not declare', async () => {
    const { host, call } = setup([], contributions);
    expect(await call(Call.Render, { contribution: 'ghost', tree })).toMatchObject({ ok: false });
    expect(await call(Call.Render, { contribution: 'ov', tree })).toMatchObject({ ok: false });
    expect(host.ui('acme.test', 'ghost')).toEqual([]);
  });

  it('keeps overlay handles only for an overlay contribution', async () => {
    const { host, call } = setup([], contributions);
    const handles = [{ id: 'p1', x: 0.5, y: 0.5, color: '#fff', selected: true }];
    expect(await call(Call.Overlay, { contribution: 'ov', handles })).toMatchObject({ ok: true });
    expect(host.handles('acme.test', 'ov')).toEqual(handles);
    expect(await call(Call.Overlay, { contribution: 'main', handles })).toMatchObject({ ok: false });
  });
});

describe('signals to the plugin', () => {
  it('sends the selection only to plugins allowed to read it', () => {
    const allowed = setup(['selection']);
    allowed.host.selectionChanged(SELECTION);
    expect(allowed.plugin.sent).toContainEqual({ type: 'signal', signal: Signal.Selection, payload: { selection: SELECTION } });
    const denied = setup([]);
    denied.host.selectionChanged(SELECTION);
    expect(denied.plugin.sent).toEqual([]);
  });

  it('forwards control, handle, menu and command events', () => {
    const { host, plugin } = setup([]);
    host.control('acme.test', 'main', 'size', 4);
    host.handle('acme.test', 'ov', 'p1', HandlePhase.Move, 0.2, 0.3);
    host.menu('acme.test', 'item', null, Place.After);
    host.command('acme.test', 'go');
    expect(plugin.sent.map((m) => (m.type === 'signal' ? m.signal : null))).toEqual([Signal.Control, Signal.Handle, Signal.Menu, Signal.Command]);
  });

  it('ignores events for a plugin that is not loaded', () => {
    const { host, plugin } = setup([]);
    host.control('ghost', 'main', 'size', 4);
    expect(plugin.sent).toEqual([]);
  });
});
