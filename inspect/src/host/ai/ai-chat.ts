import { readFile } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import { inside } from '@feega/live-edit/live-ask';
import { AdapterState, AiState, ToView, type AdapterRow, type ChatRow, type ViewMessage } from '../../messages';
import type { AgentEnv } from '../agents';
import { AcpId, acpAgents, launchOf } from './acp-agents';
import type { Adapters } from './adapters';
import { isPolicy, type Policy } from './permission-policy';
import { AgentEventKind, type AgentEvent, type AgentFiles, type AgentSession, type ConfigView, type ModeView, type OpenAgent } from './agent-session';
import { turnWatch, type TurnWatch } from './turn-changes';
import { answered, heard as transcribed, said, ItemKind, type Item } from './transcript';

const OUTSIDE = 'is outside the workspace';
const NOT_STARTED = 'start an agent first';
const DELETE_ACTION = 'Delete';
const FORGOT = "New session — the agent doesn't remember earlier messages";
const TITLE_MAX = 40;
const KEPT_CHATS = 50;

export const MAX_LIVE = 4;

export type ChatRecord = { id: string; agent: AcpId; title: string; createdAt: number; updatedAt: number; sessionId: string | null; mode: string | null; modes: ModeView[]; configs: ConfigView[]; chosen: Record<string, string>; items: Item[] };

export type ChatStore = { load: () => ChatRecord[]; save: (records: ChatRecord[]) => void };

type Chat = { record: ChatRecord; live: AgentSession | null; busy: boolean; opening: boolean; watch: TurnWatch | null; settling: Promise<void> };

export type AiChatDeps = {
  root: () => string;
  env: () => AgentEnv;
  open: OpenAgent;
  confirm: (question: string, yes: string) => Promise<boolean>;
  where: () => string;
  adapters: Adapters;
  post: (message: ViewMessage) => unknown;
  write: (path: string, content: string, agent: string) => Promise<void>;
  record: (path: string, before: string, after: string, agent: string) => Promise<void>;
  policy: { get: () => Policy; set: (policy: Policy) => void };
  store: ChatStore;
  now: () => number;
  newId: () => string;
  created: (chats: number, live: number) => void;
  configured: (category: string, value: string) => void;
};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const slice = (text: string, from?: number, count?: number): string => {
  if (from === undefined && count === undefined) {
    return text;
  }
  const start = Math.max((from ?? 1) - 1, 0);
  return text.split('\n').slice(start, count === undefined ? undefined : start + count).join('\n');
};

const titleOf = (text: string): string => (text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trimEnd()}…` : text);

export function aiChat(deps: AiChatDeps) {
  const { post } = deps;
  const chats = new Map<string, Chat>();
  let active: string | null = null;
  let loaded = false;

  const labelOf = (id: AcpId): string => acpAgents(deps.env()).find((a) => a.id === id)?.label ?? id;

  const current = (): Chat | undefined => (active ? chats.get(active) : undefined);

  const stateOf = (chat: Chat): AiState => (chat.opening ? AiState.Starting : chat.busy ? AiState.Busy : AiState.Ready);

  const live = (): Chat[] => [...chats.values()].filter((c) => c.live);

  const rows = (): ChatRow[] =>
    [...chats.values()]
      .sort((a, b) => b.record.updatedAt - a.record.updatedAt)
      .map(({ record, busy }) => ({ id: record.id, agent: record.agent, title: record.title, updatedAt: record.updatedAt, running: busy }));

  const postChats = () => post({ kind: ToView.AiChats, chats: rows(), active });

  const persist = () => deps.store.save([...chats.values()].map((c) => c.record).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, KEPT_CHATS));

  const state = (chat: Chat, next: AiState = stateOf(chat)) => {
    post({ kind: ToView.AiState, state: next, agent: chat.record.agent, chat: chat.record.id });
    postChats();
  };

  const snapshot = (chat: Chat | undefined) =>
    post(
      chat
        ? { kind: ToView.AiChat, chat: chat.record.id, agent: chat.record.agent, state: stateOf(chat), items: chat.record.items, modes: chat.record.modes, mode: chat.record.mode, configs: chat.record.configs }
        : { kind: ToView.AiChat, chat: null, state: AiState.Idle, items: [], modes: [], mode: null, configs: [] }
    );

  const failed = (reason: string, chat?: string) => post({ kind: ToView.AiEvent, event: { kind: AgentEventKind.Failed, reason }, chat });

  const inRoot = (path: string): string => {
    const rel = isAbsolute(path) ? relative(deps.root(), path) : path;
    if (!inside(deps.root(), rel)) {
      throw new Error(`${path} ${OUTSIDE}`);
    }
    return rel;
  };

  const files = (label: () => string, watch: () => TurnWatch | null): AgentFiles => ({
    read: async (path, from, count) => slice(await readFile(`${deps.root()}/${inRoot(path)}`, 'utf8'), from, count),
    write: async (path, content) => {
      const rel = inRoot(path);
      await deps.write(rel, content, label());
      watch()?.wrote(rel, content);
    }
  });

  const recorded = async (chat: Chat) => {
    const watch = chat.watch;
    chat.watch = null;
    try {
      for (const { path, before, after } of (await watch?.settle()) ?? []) {
        await deps.record(path, before, after, labelOf(chat.record.agent));
      }
    } catch (error) {
      failed(error instanceof Error ? error.message : String(error), chat.record.id);
    }
  };

  const heard = (chat: Chat, event: AgentEvent) => {
    if (event.kind !== AgentEventKind.Done && event.kind !== AgentEventKind.Failed) {
      deliver(chat, event);
      return;
    }
    chat.settling = recorded(chat).then(() => deliver(chat, event));
  };

  const deliver = (chat: Chat, event: AgentEvent) => {
    const { record } = chat;
    record.items = transcribed(record.items, event);
    if (event.kind === AgentEventKind.Modes) {
      record.modes = event.available;
      record.mode = event.current;
    }
    if (event.kind === AgentEventKind.Config) {
      record.configs = event.options;
    }
    post({ kind: ToView.AiEvent, event, chat: record.id });
    if (event.kind === AgentEventKind.Done || event.kind === AgentEventKind.Failed) {
      chat.busy = false;
      chat.live = event.kind === AgentEventKind.Failed ? null : chat.live;
      record.updatedAt = deps.now();
      persist();
      state(chat);
    }
  };

  const room = (): boolean => {
    if (live().length < MAX_LIVE) {
      return true;
    }
    const idle = live().find((c) => !c.busy && c.record.id !== active);
    idle?.live?.close();
    if (idle) {
      idle.live = null;
    }
    return idle !== undefined;
  };

  const installed = async (chat: Chat, id: AcpId): Promise<boolean> => {
    if (deps.adapters.ready(id)) {
      return true;
    }
    chat.opening = true;
    state(chat);
    try {
      await deps.adapters.install(id);
      return true;
    } catch (error) {
      chat.opening = false;
      deliver(chat, { kind: AgentEventKind.Failed, reason: messageOf(error) });
      return false;
    }
  };

  async function connect(chat: Chat): Promise<boolean> {
    const { record } = chat;
    const agent = acpAgents(deps.env()).find((a) => a.id === record.agent);
    if (!agent) {
      return false;
    }
    if (!agent.installed) {
      failed(`${agent.label} is not installed. Install it with: ${agent.install}`, record.id);
      return false;
    }
    if (agent.adapter && !(await installed(chat, agent.id))) {
      return false;
    }
    if (!room()) {
      failed(`${MAX_LIVE} chats are already working. Stop one or wait for it to finish.`, record.id);
      return false;
    }
    chat.opening = true;
    state(chat);
    try {
      const session = await deps.open(agent.adapter ? deps.adapters.launch(agent.id) : launchOf(agent.id)!, { cwd: deps.root(), resume: record.sessionId, preferred: record.chosen, files: files(() => agent.label, () => chat.watch), policy: deps.policy.get, emit: (event) => heard(chat, event) });
      chat.live = session;
      if (record.items.length && !session.resumed) {
        record.items = [...record.items, { kind: ItemKind.Note, text: FORGOT }];
      }
      record.sessionId = session.id;
      return true;
    } catch (error) {
      failed(error instanceof Error ? error.message : String(error), record.id);
      return false;
    } finally {
      chat.opening = false;
    }
  }

  function load() {
    if (loaded) {
      return;
    }
    loaded = true;
    deps.store.load().forEach((record) => chats.set(record.id, { record: { ...record, configs: record.configs ?? [], chosen: record.chosen ?? {} }, live: null, busy: false, opening: false, watch: null, settling: Promise.resolve() }));
    active = rows()[0]?.id ?? null;
  }

  const lastChosen = (agent: AcpId): Record<string, string> =>
    [...chats.values()]
      .map((c) => c.record)
      .filter((r) => r.agent === agent && Object.keys(r.chosen).length)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.chosen ?? {};

  async function start(agent: AcpId) {
    load();
    const now = deps.now();
    const chat: Chat = { record: { id: deps.newId(), agent, title: '', createdAt: now, updatedAt: now, sessionId: null, mode: null, modes: [], configs: [], chosen: { ...lastChosen(agent) }, items: [] }, live: null, busy: false, opening: true, watch: null, settling: Promise.resolve() };
    chats.set(chat.record.id, chat);
    active = chat.record.id;
    snapshot(chat);
    if (!(await connect(chat))) {
      if (!chat.record.items.length) {
        chats.delete(chat.record.id);
        active = rows()[0]?.id ?? null;
      }
      snapshot(current());
      postChats();
      return;
    }
    persist();
    deps.created(chats.size, live().length);
    state(chat);
  }

  async function send(text: string, context: string | null) {
    const chat = current();
    if (!chat) {
      failed(NOT_STARTED);
      return;
    }
    const { record } = chat;
    const resumedFresh = !chat.live;
    if (!chat.live && !(await connect(chat))) {
      state(chat);
      return;
    }
    record.items = said(record.items, text, context);
    record.title ||= titleOf(text);
    record.updatedAt = deps.now();
    chat.busy = true;
    if (resumedFresh) {
      snapshot(chat);
    }
    state(chat);
    persist();
    const session = chat.live!;
    chat.watch = turnWatch(deps.root());
    await chat.watch.begin();
    await session.send(context ? `${context}\n${deps.where()}\n\n${text}` : text);
    await chat.settling;
  }

  async function retry() {
    const chat = current();
    if (!chat || chat.live || chat.opening) {
      return;
    }
    if (chat.record.items.at(-1)?.kind === ItemKind.Error) {
      chat.record.items = chat.record.items.slice(0, -1);
      snapshot(chat);
    }
    if (await connect(chat)) {
      persist();
    }
    state(chat);
  }

  async function prepare() {
    const rows: AdapterRow[] = acpAgents(deps.env())
      .filter((a) => a.installed && a.adapter)
      .map(({ id, label }) => ({ agent: id, label, state: deps.adapters.ready(id) ? AdapterState.Ready : AdapterState.Installing }));
    const announce = () => post({ kind: ToView.Adapters, rows: rows.map((r) => ({ ...r })) });
    announce();
    for (const row of rows.filter((r) => r.state === AdapterState.Installing)) {
      try {
        await deps.adapters.install(row.agent);
        row.state = AdapterState.Ready;
      } catch (error) {
        row.state = AdapterState.Failed;
        row.reason = messageOf(error);
      }
      announce();
    }
  }

  function open(id: string) {
    const chat = chats.get(id);
    if (!chat) {
      return;
    }
    active = id;
    snapshot(chat);
    postChats();
  }

  async function setConfig(id: string, value: string) {
    const chat = current();
    const option = chat?.record.configs.find((o) => o.id === id);
    if (!chat?.live || !option) {
      return;
    }
    try {
      await chat.live.setConfig(id, value);
    } catch (error) {
      failed(error instanceof Error ? error.message : String(error), chat.record.id);
      return;
    }
    chat.record.chosen = { ...chat.record.chosen, [id]: value };
    chat.record.updatedAt = deps.now();
    persist();
    postChats();
    deps.configured(option.category, value);
  }

  function rename(id: string, title: string) {
    const chat = chats.get(id);
    if (!chat || !title.trim()) {
      return;
    }
    chat.record.title = title.trim();
    persist();
    postChats();
  }

  async function remove(id: string) {
    const chat = chats.get(id);
    if (!chat || !(await deps.confirm(`Delete "${chat.record.title || 'this chat'}"?`, DELETE_ACTION))) {
      return;
    }
    chat.live?.close();
    chats.delete(id);
    persist();
    if (active === id) {
      active = null;
      snapshot(undefined);
    }
    postChats();
  }

  function answer(id: string, optionId: string | null) {
    const chat = current();
    if (!chat) {
      return;
    }
    const ask = chat.record.items.find((i) => i.kind === ItemKind.Permission && i.id === id);
    const name = ask?.kind === ItemKind.Permission ? (ask.options.find((o) => o.id === optionId)?.name ?? 'Cancelled') : '';
    chat.record.items = answered(chat.record.items, id, name);
    chat.live?.answer(id, optionId);
  }

  return {
    list: () => {
      load();
      post({ kind: ToView.AiPolicy, policy: deps.policy.get() });
      post({ kind: ToView.AiAgents, agents: acpAgents(deps.env()) });
      snapshot(current());
      postChats();
    },
    setPolicy: (policy: Policy) => {
      if (isPolicy(policy)) {
        deps.policy.set(policy);
        post({ kind: ToView.AiPolicy, policy });
      }
    },
    setConfig,
    retry,
    prepare,
    setMode: async (id: string) => void (await current()?.live?.setMode(id)),
    start,
    send,
    open,
    rename,
    remove,
    cancel: async () => void (await current()?.live?.cancel()),
    answer,
    close: () => live().forEach((c) => (c.live?.close(), (c.live = null)))
  };
}
