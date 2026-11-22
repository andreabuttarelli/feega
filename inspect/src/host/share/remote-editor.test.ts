import { describe, expect, it } from 'vitest';
import { ToHost, ToView, type HostMessage, type ViewMessage } from '../../messages';
import type { Transport } from '../platform';
import type { EditorServer } from '../editor-server';
import { withRemoteEditor } from './remote-editor';

function fakeTransport() {
  const sent: ViewMessage[] = [];
  const handlers: ((message: HostMessage) => unknown)[] = [];
  const transport: Transport = { send: (m) => void sent.push(m), receive: (h) => void handlers.push(h) };
  return { transport, sent, deliver: (m: HostMessage) => handlers.forEach((h) => h(m)) };
}

function rig() {
  const panel = fakeTransport();
  const remote = fakeTransport();
  const starts: number[] = [];
  let closed = 0;
  const startEditor = async (): Promise<EditorServer> => (starts.push(1), { url: 'http://127.0.0.1:7777/', transport: remote.transport, close: async () => void (closed += 1) });
  const wrapped = withRemoteEditor(panel.transport, startEditor);
  return { panel, remote, wrapped, starts, closed: () => closed };
}

const status: ViewMessage = { kind: ToView.Status, text: 'hi' };

describe('withRemoteEditor', () => {
  it('does not start a server until it is asked for the address', async () => {
    const { wrapped, starts } = rig();

    await wrapped.transport.send(status);

    expect(starts).toEqual([]);
  });

  it('starts once and gives the address', async () => {
    const { wrapped, starts } = rig();

    expect(await wrapped.editorUrl()).toBe('http://127.0.0.1:7777/');
    expect(await wrapped.editorUrl()).toBe('http://127.0.0.1:7777/');
    expect(starts).toHaveLength(1);
  });

  it('sends to the panel and to the remote editor once it exists', async () => {
    const { wrapped, panel, remote } = rig();
    wrapped.transport.send(status);
    await wrapped.editorUrl();

    wrapped.transport.send(status);

    expect(panel.sent).toHaveLength(2);
    expect(remote.sent).toEqual([status]);
  });

  it('hears the panel and, once it exists, the remote editor, including handlers added before', async () => {
    const { wrapped, panel, remote } = rig();
    const heard: HostMessage[] = [];
    wrapped.transport.receive((m) => void heard.push(m));
    await wrapped.editorUrl();

    panel.deliver({ kind: ToHost.Ready });
    remote.deliver({ kind: ToHost.Undo });

    expect(heard).toEqual([{ kind: ToHost.Ready }, { kind: ToHost.Undo }]);
  });

  it('hears a handler added after the server started on both channels', async () => {
    const { wrapped, panel, remote } = rig();
    await wrapped.editorUrl();
    const heard: HostMessage[] = [];

    wrapped.transport.receive((m) => void heard.push(m));
    panel.deliver({ kind: ToHost.Ready });
    remote.deliver({ kind: ToHost.Redo });

    expect(heard).toHaveLength(2);
  });

  it('closes the remote editor and can start a new one later', async () => {
    const { wrapped, starts, closed } = rig();
    await wrapped.editorUrl();

    await wrapped.stop();
    await wrapped.stop();
    await wrapped.editorUrl();

    expect(closed()).toBe(1);
    expect(starts).toHaveLength(2);
  });
});
