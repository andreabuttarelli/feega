import { lockdown } from './lockdown';
import {
  Call,
  Signal,
  type CallArgs,
  type CallResult,
  type Css,
  type Fetched,
  type Handle,
  type HandlePhase,
  type HostMessage,
  type Op,
  type Outcome,
  type Picked,
  type Place,
  type PluginMessage,
  type ProjectInfo,
  type Selection,
  type Signals,
  type Source,
  type UiNode
} from './protocol';

export type Port = { post: (message: PluginMessage) => void; listen: (handle: (message: HostMessage) => void) => void };

type Listener<S extends Signal> = (payload: Signals[S]) => void;

export function createApi(port: Port) {
  let next = 0;
  const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const listeners = new Map<Signal, Listener<Signal>[]>();

  port.listen((message) => {
    if (message.type === 'signal') {
      listeners.get(message.signal)?.forEach((listener) => listener(message.payload as never));
      return;
    }
    const pending = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.ok) {
      pending?.resolve(message.value);
      return;
    }
    pending?.reject(new Error(message.reason));
  });

  function call<K extends Call>(name: K, args?: CallArgs[K]): Promise<CallResult[K]> {
    const id = ++next;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
      port.post({ type: 'call', id, call: name, args });
    });
  }

  function on<S extends Signal>(signal: S, listener: Listener<S>) {
    listeners.set(signal, [...(listeners.get(signal) ?? []), listener as Listener<Signal>]);
  }

  return {
    selection: {
      get: (): Promise<Selection | null> => call(Call.Selection),
      on: (listener: (selection: Selection | null) => void) => on(Signal.Selection, (p) => listener(p.selection)),
      watch: (listener: (selection: Selection | null) => void) => {
        let changed = false;
        on(Signal.Selection, (p) => ((changed = true), listener(p.selection)));
        void call(Call.Selection).then((current) => !changed && listener(current));
      }
    },
    project: { info: (): Promise<ProjectInfo> => call(Call.Project) },
    source: { text: (): Promise<string | null> => call(Call.SourceText) },
    propose: (label: string, ops: Op[]): Promise<Outcome> => call(Call.Propose, { label, ops }),
    preview: (at: string, css: Css | null): Promise<null> => call(Call.Preview, { at, css }),
    fetch: (url: string): Promise<Fetched> => call(Call.Fetch, { url }),
    notify: (text: string): Promise<null> => call(Call.Notify, { text }),
    pickFile: (accept: string[]): Promise<Picked | null> => call(Call.PickFile, { accept }),
    section: (contribution: string) => ({
      render: (tree: UiNode[]) => call(Call.Render, { contribution, tree }),
      on: (listener: (id: string, value: string | number | boolean, live: boolean) => void) => on(Signal.Control, (p) => p.contribution === contribution && listener(p.id, p.value, p.live))
    }),
    overlay: (contribution: string) => ({
      render: (handles: Handle[]) => call(Call.Overlay, { contribution, handles }),
      on: (listener: (id: string, phase: HandlePhase, x: number, y: number) => void) => on(Signal.Handle, (p) => p.contribution === contribution && listener(p.id, p.phase, p.x, p.y))
    }),
    menu: { on: (listener: (item: string, target: Source | null, place: Place | null) => void) => on(Signal.Menu, (p) => listener(p.item, p.target, p.place)) },
    command: { on: (listener: (command: string) => void) => on(Signal.Command, (p) => listener(p.command)) },
    action: { on: (listener: (action: string) => void) => on(Signal.Action, (p) => listener(p.action)) }
  };
}

export type PluginApi = ReturnType<typeof createApi>;

type WorkerScope = Record<string, unknown> & { postMessage: (message: unknown) => void; addEventListener: (type: 'message', handle: (event: { data: HostMessage }) => void) => void };

export function runPlugin(setup: (api: PluginApi) => void, scope: WorkerScope = self as unknown as WorkerScope) {
  const post = scope.postMessage.bind(scope);
  lockdown(scope);
  setup(createApi({ post, listen: (handle) => scope.addEventListener('message', (event) => handle(event.data)) }));
}
