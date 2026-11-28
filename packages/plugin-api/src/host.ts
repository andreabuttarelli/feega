import { Point, type Contribution, type Manifest, parseManifest } from './manifest';
import { CALL_PERMISSION, OP_PERMISSION, hostAllowed, missing } from './permissions';
import {
  Call,
  OpKind,
  Signal,
  type CallArgs,
  type CallResult,
  type Css,
  type Fetched,
  type Handle,
  type HandlePhase,
  type HostMessage,
  type Outcome,
  type Picked,
  type Place,
  type PluginMessage,
  type ProjectInfo,
  type Proposal,
  type Selection,
  type Source,
  type UiNode
} from './protocol';

export type Channel = { post: (message: HostMessage) => void; listen: (handle: (message: PluginMessage) => void) => void; close: () => void };

export type Sandbox = (id: string, code: string) => Channel;

export type EditorPort = {
  selection: () => Selection | null;
  project: () => Promise<ProjectInfo>;
  sourceText: () => Promise<string | null>;
  propose: (proposal: Proposal) => Promise<Outcome>;
  preview: (at: string, css: Css | null) => void;
  fetch: (url: string) => Promise<Fetched>;
  pickFile: (accept: string[]) => Promise<Picked | null>;
  notify: (text: string) => void;
};

export type Contributed = { plugin: string; entry: Contribution; owns: string[] };

type Loaded = { manifest: Manifest; channel: Channel; ui: Map<string, UiNode[]>; handles: Map<string, Handle[]> };

type Context = { plugin: Loaded; editor: EditorPort; changed: () => void };

type Handler<K extends Call> = (context: Context, args: CallArgs[K]) => Promise<CallResult[K]> | CallResult[K];

const CALLS = new Set<string>(Object.values(Call));
const OP_KINDS = new Set<string>(Object.values(OpKind));

const declares = (manifest: Manifest, points: Point[], id: string) => points.some((point) => (manifest.contributions[point] ?? []).some((entry) => entry.id === id));

const isProposal = (value: unknown): value is Proposal => {
  const proposal = value as Proposal | null;
  return typeof proposal?.label === 'string' && Array.isArray(proposal.ops) && proposal.ops.every((op) => OP_KINDS.has(String(op?.kind)));
};

async function propose({ plugin, editor }: Context, proposal: unknown): Promise<Outcome> {
  if (!isProposal(proposal)) {
    return { ok: false, reason: 'the proposal is malformed' };
  }
  const denied = proposal.ops.map((op) => missing(plugin.manifest, OP_PERMISSION[op.kind])).find((reason) => reason !== null);
  return denied ? { ok: false, reason: denied } : editor.propose(proposal);
}

function remember<T>(store: Map<string, T>, manifest: Manifest, points: Point[], contribution: string, value: T, changed: () => void): null {
  if (!declares(manifest, points, contribution)) {
    throw new Error(`${manifest.id} declares no ${points.join(' or ')} contribution ${contribution}`);
  }
  store.set(contribution, value);
  changed();
  return null;
}

async function fetched({ plugin, editor }: Context, args: { url: string }): Promise<Fetched> {
  const refused = hostAllowed(plugin.manifest, args.url);
  if (refused) {
    throw new Error(refused);
  }
  return editor.fetch(args.url);
}

const HANDLERS: { [K in Call]: Handler<K> } = {
  [Call.Selection]: ({ editor }) => editor.selection(),
  [Call.Project]: ({ editor }) => editor.project(),
  [Call.SourceText]: ({ editor }) => editor.sourceText(),
  [Call.Propose]: propose,
  [Call.Preview]: ({ editor }, args) => (editor.preview(args.at, args.css), null),
  [Call.Fetch]: fetched,
  [Call.PickFile]: ({ editor }, args) => editor.pickFile(args.accept),
  [Call.Notify]: ({ editor }, args) => (editor.notify(args.text), null),
  [Call.Render]: ({ plugin, changed }, args) => remember(plugin.ui, plugin.manifest, [Point.RightBar, Point.Popover], args.contribution, args.tree, changed),
  [Call.Overlay]: ({ plugin, changed }, args) => remember(plugin.handles, plugin.manifest, [Point.Overlay], args.contribution, args.handles, changed)
};

const isCall = (message: unknown): message is PluginMessage => {
  const call = message as PluginMessage | null;
  return call?.type === 'call' && Number.isInteger(call.id) && CALLS.has(call.call);
};

export function createPluginHost(deps: { sandbox: Sandbox; editor: EditorPort }) {
  const plugins = new Map<string, Loaded>();
  const watchers = new Set<() => void>();
  const changed = () => watchers.forEach((watch) => watch());

  async function answer(plugin: Loaded, message: PluginMessage) {
    const refused = missing(plugin.manifest, CALL_PERMISSION[message.call]);
    if (refused) {
      plugin.channel.post({ type: 'result', id: message.id, ok: false, reason: refused });
      return;
    }
    try {
      const handler = HANDLERS[message.call] as (context: Context, args: unknown) => unknown;
      const value = await handler({ plugin, editor: deps.editor, changed }, message.args);
      plugin.channel.post({ type: 'result', id: message.id, ok: true, value });
    } catch (error) {
      plugin.channel.post({ type: 'result', id: message.id, ok: false, reason: (error as Error).message });
    }
  }

  const signal = <S extends Signal>(plugin: Loaded | undefined, name: S, payload: unknown) => plugin?.channel.post({ type: 'signal', signal: name, payload });

  function load(manifest: Manifest, code: string): { ok: true } | { ok: false; reason: string } {
    const checked = parseManifest({ ...manifest, permissions: [...(manifest.grants ?? []), ...(manifest.hosts ?? []).map((host) => `network:${host}`)] });
    if (!checked.ok) {
      return checked;
    }
    if (plugins.has(manifest.id)) {
      return { ok: false, reason: `${manifest.id} is already loaded` };
    }
    const plugin: Loaded = { manifest: checked.manifest, channel: deps.sandbox(manifest.id, code), ui: new Map(), handles: new Map() };
    plugin.channel.listen((message) => isCall(message) && answer(plugin, message));
    plugins.set(manifest.id, plugin);
    changed();
    return { ok: true };
  }

  function unload(id: string) {
    plugins.get(id)?.channel.close();
    plugins.delete(id);
    changed();
  }

  return {
    load,
    unload,
    manifests: () => [...plugins.values()].map((p) => p.manifest),
    contributions: (point: Point): Contributed[] => [...plugins.values()].flatMap((p) => (p.manifest.contributions[point] ?? []).map((entry) => ({ plugin: p.manifest.id, entry, owns: p.manifest.owns }))),
    ui: (plugin: string, contribution: string): UiNode[] => plugins.get(plugin)?.ui.get(contribution) ?? [],
    handles: (plugin: string, contribution: string): Handle[] => plugins.get(plugin)?.handles.get(contribution) ?? [],
    subscribe: (watch: () => void) => (watchers.add(watch), () => watchers.delete(watch)),
    selectionChanged: (selection: Selection | null) => plugins.forEach((p) => !missing(p.manifest, CALL_PERMISSION[Call.Selection]) && signal(p, Signal.Selection, { selection })),
    control: (plugin: string, contribution: string, id: string, value: string | number | boolean, live = false) => signal(plugins.get(plugin), Signal.Control, { contribution, id, value, live }),
    handle: (plugin: string, contribution: string, id: string, phase: HandlePhase, x: number, y: number) => signal(plugins.get(plugin), Signal.Handle, { contribution, id, phase, x, y }),
    menu: (plugin: string, item: string, target: Source | null, place: Place | null = null) => signal(plugins.get(plugin), Signal.Menu, { item, target, place }),
    command: (plugin: string, command: string) => signal(plugins.get(plugin), Signal.Command, { command }),
    action: (plugin: string, action: string) => signal(plugins.get(plugin), Signal.Action, { action })
  };
}
