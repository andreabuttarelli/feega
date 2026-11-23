import { describe, expect, it, vi } from 'vitest';
import { OpKind } from '@feega/plugin-api/protocol';
import { PluginCall, ToHost, ToView, type HostMessage, type Pick } from '../messages';
import { editorPort, hostCalls, selectionOf, sourceOfText } from './plugin-editor';

const PICK: Pick = {
  source: { file: 'src/A.svelte', line: 3, col: 5 },
  component: { file: 'src/P.svelte', line: 9, col: 1 },
  tag: 'div',
  rect: { x: 1, y: 2, width: 30, height: 40 },
  styles: { color: 'red' },
  classes: 'a b',
  rem: 16,
  viewport: 1000,
  ownText: false,
  inlineText: false,
  elements: 1,
  name: 'div',
  parentWidth: 100,
  instances: 1,
  instanceIndex: 0,
  usage: { index: 0, count: 1 },
  classCount: 0,
  ancestors: [],
  attributes: [{ name: 'data-x', value: '1' }]
};

function setup(pick: Pick | null = PICK) {
  const sent: HostMessage[] = [];
  const calls = hostCalls((m) => sent.push(m));
  const preview = vi.fn();
  const notify = vi.fn();
  const port = editorPort({ pick: () => pick, calls, preview, notify, pickFile: async () => ({ name: 'a.glb', base64: 'AA==' }) });
  return { sent, calls, port, preview, notify };
}

describe('selectionOf', () => {
  it('hands plugins the facts they may read and nothing else', () => {
    expect(selectionOf(PICK)).toEqual({ source: PICK.source, component: PICK.component, tag: 'div', name: 'div', classes: 'a b', rect: PICK.rect, styles: { color: 'red' }, attributes: [{ name: 'data-x', value: '1' }] });
  });

  it('gives an empty attribute list when the page sent none', () => {
    expect(selectionOf({ ...PICK, attributes: undefined }).attributes).toEqual([]);
  });
});

describe('sourceOfText', () => {
  it('splits file:line:col, even when the file has colons', () => {
    expect(sourceOfText('src/a:b.svelte:3:5')).toEqual({ file: 'src/a:b.svelte', line: 3, col: 5 });
  });
});

describe('hostCalls', () => {
  it('sends the ask with an id and resolves with the answer', async () => {
    const { calls, sent } = setup();
    const pending = calls.ask({ call: PluginCall.Project });
    expect(sent).toEqual([{ kind: ToHost.Plugin, id: 1, ask: { call: PluginCall.Project } }]);
    calls.answer(1, { ok: true, value: { typescript: true } });
    expect(await pending).toEqual({ typescript: true });
  });

  it('rejects with the reason the host gave', async () => {
    const { calls } = setup();
    const pending = calls.ask({ call: PluginCall.Source, at: 'a:1:1' });
    calls.answer(1, { ok: false, reason: 'nope' });
    await expect(pending).rejects.toThrow('nope');
  });

  it('keeps concurrent asks apart', async () => {
    const { calls } = setup();
    const a = calls.ask({ call: PluginCall.Project });
    const b = calls.ask({ call: PluginCall.Project });
    calls.answer(2, { ok: true, value: 'b' });
    calls.answer(1, { ok: true, value: 'a' });
    expect([await a, await b]).toEqual(['a', 'b']);
  });

  it('ignores an answer nobody asked for', () => {
    const { calls } = setup();
    expect(() => calls.answer(99, { ok: true, value: 1 })).not.toThrow();
  });
});

describe('editorPort', () => {
  it('reads the current pick', () => {
    expect(setup().port.selection()?.source).toEqual(PICK.source);
    expect(setup(null).port.selection()).toBeNull();
  });

  it('forwards a proposal to the host and reports its outcome', async () => {
    const { port, calls, sent } = setup();
    const pending = port.propose({ label: 'x', ops: [{ kind: OpKind.Dependency, name: 'a', version: '1.0.0' }] });
    expect(sent[0]).toMatchObject({ kind: ToHost.Plugin, ask: { call: PluginCall.Propose } });
    calls.answer(1, { ok: true, value: { ok: true } });
    expect(await pending).toEqual({ ok: true });
  });

  it('turns a failed ask into a refused outcome for a proposal', async () => {
    const { port, calls } = setup();
    const pending = port.propose({ label: 'x', ops: [] });
    calls.answer(1, { ok: false, reason: 'host gone' });
    expect(await pending).toEqual({ ok: false, reason: 'host gone' });
  });

  it('previews css with camelCase keys and clears with null', () => {
    const { port, preview } = setup();
    port.preview('src/A.svelte:3:5', { 'background-image': 'none', 'background-color': 'red' });
    expect(preview).toHaveBeenCalledWith({ file: 'src/A.svelte', line: 3, col: 5 }, { backgroundImage: 'none', backgroundColor: 'red' });
    port.preview('src/A.svelte:3:5', null);
    expect(preview).toHaveBeenLastCalledWith({ file: 'src/A.svelte', line: 3, col: 5 }, null);
  });

  it('shows notices and picks files through its deps', async () => {
    const { port, notify } = setup();
    port.notify('hi');
    expect(notify).toHaveBeenCalledWith('hi');
    expect(await port.pickFile(['.glb'])).toEqual({ name: 'a.glb', base64: 'AA==' });
  });

  it('reads source text and project facts through the host', async () => {
    const { port, calls } = setup();
    const text = port.sourceText();
    calls.answer(1, { ok: true, value: '<p/>' });
    expect(await text).toBe('<p/>');
    const info = port.project();
    calls.answer(2, { ok: true, value: { typescript: false, publicDir: 'static' } });
    expect(await info).toEqual({ typescript: false, publicDir: 'static' });
  });

  it('knows the view message that answers', () => {
    expect(ToView.Plugin).toBe('plugin');
  });
});
