import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { client, methods, ndJsonStream, PROTOCOL_VERSION, type RequestPermissionRequest, type SessionNotification, type ToolCall, type ToolCallContent, type ToolCallUpdate } from '@agentclientprotocol/sdk';
import type { SessionConfigOption } from '@agentclientprotocol/sdk';
import { autoAnswer } from './permission-policy';
import { AgentEventKind, ConfigCategory, ToolStatus, type AgentDeps, type AgentSession, type ConfigView, type DiffView, type Launch, type ModeView, type OptionView, type ToolView } from './agent-session';

const CLIENT_NAME = 'feega';
const CANCELLED = { outcome: { outcome: 'cancelled' as const } };
const AUTH_REQUIRED = -32000;
const ALLOWS = new Set(['allow_once', 'allow_always']);

const STATUSES: Record<string, ToolStatus> = {
  pending: ToolStatus.Pending,
  in_progress: ToolStatus.Running,
  completed: ToolStatus.Done,
  failed: ToolStatus.Failed
};

const diffsOf = (content: ToolCallContent[] | null | undefined): DiffView[] =>
  (content ?? []).flatMap((part) => (part.type === 'diff' ? [{ path: part.path, before: part.oldText ?? null, after: part.newText }] : []));

const CATEGORIES = new Set<string>(Object.values(ConfigCategory));

const valuesOf = (option: SessionConfigOption & { type: 'select' }) =>
  option.options.flatMap((entry) => ('group' in entry ? entry.options : [entry])).map((v) => ({ id: v.value, name: v.name, description: v.description ?? '' }));

const configsOf = (options: SessionConfigOption[] | null | undefined): ConfigView[] =>
  (options ?? []).flatMap((o) =>
    o.type === 'select' && o.category && CATEGORIES.has(o.category) ? [{ id: o.id, name: o.name, category: o.category as ConfigCategory, current: o.currentValue, values: valuesOf(o) }] : []
  );

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const openAcpAgent = async (launch: Launch, deps: AgentDeps): Promise<AgentSession> => {
  const child = spawn(launch.command, launch.args, { cwd: deps.cwd, stdio: ['pipe', 'pipe', 'ignore'], shell: process.platform === 'win32' });
  const tools = new Map<string, ToolView>();
  const asking = new Map<string, (optionId: string | null) => void>();
  let asked = 0;
  let sessionId = '';
  let available: ModeView[] = [];
  let configs: ConfigView[] = [];
  let replaying = false;

  const modeChanged = (current: string) => deps.emit({ kind: AgentEventKind.Modes, available, current });

  const configChanged = (options: SessionConfigOption[] | null | undefined) => {
    configs = configsOf(options);
    if (configs.length) {
      deps.emit({ kind: AgentEventKind.Config, options: configs });
    }
  };

  const toolOf = (update: ToolCall | ToolCallUpdate): ToolView => {
    const known = tools.get(update.toolCallId);
    const next: ToolView = {
      id: update.toolCallId,
      title: update.title ?? known?.title ?? '',
      kind: update.kind ?? known?.kind ?? 'other',
      status: update.status ? STATUSES[update.status] : (known?.status ?? ToolStatus.Pending),
      diffs: update.content ? diffsOf(update.content) : (known?.diffs ?? [])
    };
    tools.set(next.id, next);
    return next;
  };

  const updated = ({ update }: SessionNotification) => {
    if (replaying) {
      return;
    }
    if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      deps.emit({ kind: AgentEventKind.Text, text: update.content.text });
    } else if (update.sessionUpdate === 'agent_thought_chunk' && update.content.type === 'text') {
      deps.emit({ kind: AgentEventKind.Thought, text: update.content.text });
    } else if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
      deps.emit({ kind: AgentEventKind.Tool, tool: toolOf(update) });
    } else if (update.sessionUpdate === 'current_mode_update') {
      modeChanged(update.currentModeId);
    } else if (update.sessionUpdate === 'config_option_update') {
      configChanged(update.configOptions);
    } else if (update.sessionUpdate === 'plan') {
      deps.emit({ kind: AgentEventKind.Plan, entries: update.entries.map((e) => ({ content: e.content, status: e.status })) });
    }
  };

  const permitted = (request: RequestPermissionRequest): Promise<typeof CANCELLED | { outcome: { outcome: 'selected'; optionId: string } }> => {
    const id = String(++asked);
    const options: OptionView[] = request.options.map((o) => ({ id: o.optionId, name: o.name, allows: ALLOWS.has(o.kind) }));
    const tool = toolOf(request.toolCall as ToolCallUpdate);
    const auto = autoAnswer(deps.policy(), tool.kind, options);
    if (auto !== null) {
      deps.emit({ kind: AgentEventKind.Tool, tool });
      return Promise.resolve({ outcome: { outcome: 'selected' as const, optionId: auto } });
    }
    return new Promise((resolve) => {
      asking.set(id, (optionId) => resolve(optionId === null ? CANCELLED : { outcome: { outcome: 'selected', optionId } }));
      deps.emit({ kind: AgentEventKind.Permission, id, tool, options });
    });
  };

  const app = client({ name: CLIENT_NAME })
    .onNotification(methods.client.session.update, (cx) => updated(cx.params))
    .onRequest(methods.client.session.requestPermission, (cx) => permitted(cx.params))
    .onRequest(methods.client.fs.readTextFile, async (cx) => ({ content: await deps.files.read(cx.params.path, cx.params.line ?? undefined, cx.params.limit ?? undefined) }))
    .onRequest(methods.client.fs.writeTextFile, async (cx) => {
      await deps.files.write(cx.params.path, cx.params.content);
      return {};
    });

  const connection = app.connect(ndJsonStream(Writable.toWeb(child.stdin!), Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>));

  child.on('error', (error) => deps.emit({ kind: AgentEventKind.Failed, reason: messageOf(error) }));
  child.on('exit', (code) => deps.emit({ kind: AgentEventKind.Failed, reason: `the agent exited (${code})` }));

  const hello = await connection.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } }, clientInfo: { name: CLIENT_NAME, version: '1' } });

  const newSession = () => connection.agent.request(methods.agent.session.new, { cwd: deps.cwd, mcpServers: [] });

  const signedIn = async () => {
    for (const method of hello.authMethods ?? []) {
      const ok = await connection.agent.request(methods.agent.authenticate, { methodId: method.id }).then(() => true, () => false);
      if (ok) {
        return true;
      }
    }
    return false;
  };

  const fresh = () =>
    newSession().catch(async (error) => {
      if ((error as { code?: number }).code !== AUTH_REQUIRED || !(await signedIn())) {
        throw error;
      }
      return newSession();
    });

  const loaded = async (id: string) => {
    replaying = true;
    try {
      const response = await connection.agent.request(methods.agent.session.load, { sessionId: id, cwd: deps.cwd, mcpServers: [] });
      return { sessionId: id, modes: response.modes, configOptions: response.configOptions };
    } catch {
      return null;
    } finally {
      replaying = false;
    }
  };

  const resumed = deps.resume !== null && hello.agentCapabilities?.loadSession === true ? await loaded(deps.resume) : null;
  const created = resumed ?? (await fresh());
  sessionId = created.sessionId;
  if (created.modes?.availableModes.length) {
    available = created.modes.availableModes.map((m) => ({ id: m.id, name: m.name, description: m.description ?? '' }));
    modeChanged(created.modes.currentModeId);
  }
  configChanged(created.configOptions);

  const setConfig = async (id: string, value: string) => {
    const response = await connection.agent.request(methods.agent.session.setConfigOption, { sessionId, configId: id, value });
    configChanged(response.configOptions);
  };

  for (const { id } of [...configs]) {
    const wanted = deps.preferred[id];
    const option = configs.find((c) => c.id === id);
    if (wanted !== undefined && option && option.current !== wanted && option.values.some((v) => v.id === wanted)) {
      await setConfig(id, wanted).catch(() => undefined);
    }
  }

  const answer = (id: string, optionId: string | null) => {
    asking.get(id)?.(optionId);
    asking.delete(id);
  };

  return {
    id: sessionId,
    resumed: resumed !== null,
    send: async (prompt) => {
      try {
        const done = await connection.agent.request(methods.agent.session.prompt, { sessionId, prompt: [{ type: 'text', text: prompt }] });
        deps.emit({ kind: AgentEventKind.Done, reason: done.stopReason });
      } catch (error) {
        deps.emit({ kind: AgentEventKind.Failed, reason: messageOf(error) });
      }
    },
    cancel: async () => {
      [...asking.keys()].forEach((id) => answer(id, null));
      await connection.agent.notify(methods.agent.session.cancel, { sessionId });
    },
    answer,
    setMode: async (id) => {
      await connection.agent.request(methods.agent.session.setMode, { sessionId, modeId: id });
      modeChanged(id);
    },
    setConfig,
    close: () => {
      child.removeAllListeners('exit');
      connection.close();
      child.kill();
    }
  };
};
