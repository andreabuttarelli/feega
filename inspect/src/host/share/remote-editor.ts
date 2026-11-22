import type { HostMessage } from '../../messages';
import type { EditorServer } from '../editor-server';
import type { Transport } from '../platform';

export type RemoteEditor = { transport: Transport; editorUrl: () => Promise<string | null>; stop: () => Promise<void> };

type Handle = (message: HostMessage) => unknown;

export function withRemoteEditor(panel: Transport, startEditor: () => Promise<EditorServer>): RemoteEditor {
  const handlers: Handle[] = [];
  let remote: EditorServer | null = null;
  let starting: Promise<EditorServer> | null = null;

  const hear = (handle: Handle) => remote?.transport.receive(handle);

  async function editorUrl(): Promise<string | null> {
    starting ??= startEditor();
    const started = await starting;
    if (remote !== started) {
      remote = started;
      handlers.forEach(hear);
    }
    return started.url;
  }

  async function stop() {
    const closing = remote;
    remote = null;
    starting = null;
    await closing?.close();
  }

  const transport: Transport = {
    send: (message) => {
      remote?.transport.send(message);
      return panel.send(message);
    },
    receive: (handle) => {
      handlers.push(handle);
      panel.receive(handle);
      hear(handle);
    }
  };

  return { transport, editorUrl, stop };
}
