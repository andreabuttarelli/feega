import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { client, methods, ndJsonStream, PROTOCOL_VERSION, type RequestPermissionRequest, type SessionNotification, type ToolCall, type ToolCallContent, type ToolCallUpdate } from '@agentclientprotocol/sdk';
import { AgentEventKind, ToolStatus, type AgentDeps, type AgentSession, type DiffView, type Launch, type OptionView, type ToolView } from './agent-session';

const CLIENT_NAME = 'feega';
const CANCELLED = { outcome: { outcome: 'cancelled' as const } };
const ALLOWS = new Set(['allow_once', 'allow_always']);

const STATUSES: Record<string, ToolStatus> = {
  pending: ToolStatus.Pending,
  in_progress: ToolStatus.Running,
  completed: ToolStatus.Done,
  failed: ToolStatus.Failed
};

const diffsOf = (content: ToolCallContent[] | null | undefined): DiffView[] =>
  (content ?? []).flatMap((part) => (part.type === 'diff' ? [{ path: part.path, before: part.oldText ?? null, after: part.newText }] : []));

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const openAcpAgent = async (launch: Launch, deps: AgentDeps): Promise<AgentSession> => {
  const child = spawn(launch.command, launch.args, { cwd: deps.cwd, stdio: ['pipe', 'pipe', 'ignore'], shell: process.platform === 'win32' });
  const tools = new Map<string, ToolView>();
  const asking = new Map<string, (optionId: string | null) => void>();
  let asked = 0;
  let sessionId = '';

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
    if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      deps.emit({ kind: AgentEventKind.Text, text: update.content.text });
    } else if (update.sessionUpdate === 'agent_thought_chunk' && update.content.type === 'text') {
      deps.emit({ kind: AgentEventKind.Thought, text: update.content.text });
    } else if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
      deps.emit({ kind: AgentEventKind.Tool, tool: toolOf(update) });
    } else if (update.sessionUpdate === 'plan') {
      deps.emit({ kind: AgentEventKind.Plan, entries: update.entries.map((e) => ({ content: e.content, status: e.status })) });
    }
  };

  const permitted = (request: RequestPermissionRequest): Promise<typeof CANCELLED | { outcome: { outcome: 'selected'; optionId: string } }> => {
    const id = String(++asked);
    const options: OptionView[] = request.options.map((o) => ({ id: o.optionId, name: o.name, allows: ALLOWS.has(o.kind) }));
    return new Promise((resolve) => {
      asking.set(id, (optionId) => resolve(optionId === null ? CANCELLED : { outcome: { outcome: 'selected', optionId } }));
      deps.emit({ kind: AgentEventKind.Permission, id, tool: toolOf(request.toolCall as ToolCallUpdate), options });
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

  await connection.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } }, clientInfo: { name: CLIENT_NAME, version: '1' } });
  sessionId = (await connection.agent.request(methods.agent.session.new, { cwd: deps.cwd, mcpServers: [] })).sessionId;

  const answer = (id: string, optionId: string | null) => {
    asking.get(id)?.(optionId);
    asking.delete(id);
  };

  return {
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
    close: () => {
      child.removeAllListeners('exit');
      connection.close();
      child.kill();
    }
  };
};
