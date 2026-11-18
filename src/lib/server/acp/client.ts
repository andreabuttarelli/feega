import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { AcpOption, AcpUpdate } from '$lib/acp/acp-events';
import type { AgentModels } from '$lib/acp/agent-models';
import { modelsOf, switchFor, type NewSession } from './models';

export const ACP_PROTOCOL_VERSION = 1;

export type AgentCommand = { command: string; args: string[]; env?: Record<string, string> };

export type McpServer = { name: string; command: string; args: string[]; env: { name: string; value: string }[] };

export type AcpTurnInput = { agent: AgentCommand; cwd: string; mcpServers: McpServer[]; prompt: string; model?: string | null };

export type AcpTurn = { text: string; toolCalls: string[]; stopReason: string };

type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } };

export type PermissionAsk = { title: string; options: AcpOption[] };

export type PermissionOutcome = { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' };

export type AcpTurnHooks = {
  onUpdate: (update: AcpUpdate) => void;
  ask: (permission: PermissionAsk, signal: AbortSignal) => Promise<PermissionOutcome>;
  onStarting?: () => void;
  signal?: AbortSignal;
};

export type ThreadTurn = AcpTurnInput & { thread: string; agentId: string };

const METHOD_NOT_FOUND = -32601;

type PermissionParams = { toolCall: { title?: string }; options: AcpOption[] };

const NEVER_ABORTED = new AbortController().signal;

function parsed(line: string): Message | null {
  try {
    return JSON.parse(line) as Message;
  } catch {
    return null;
  }
}

class Connection {
  private nextId = 1;
  private readonly waiting = new Map<number, { done: (v: unknown) => void; fail: (e: Error) => void }>();
  private turn: AcpTurn = { text: '', toolCalls: [], stopReason: '' };
  private stop: AbortSignal = NEVER_ABORTED;
  exited = false;

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private hooks: AcpTurnHooks
  ) {
    createInterface({ input: child.stdout }).on('line', (line) => {
      const msg = parsed(line);
      if (msg) {
        this.receive(msg);
      }
    });
    child.on('error', (e) => this.failAll(e));
    child.on('exit', (code) => {
      this.exited = true;
      this.failAll(new Error(`ACP agent exited with code ${code}`));
    });
  }

  begin(hooks: AcpTurnHooks, stop: AbortSignal) {
    this.hooks = hooks;
    this.stop = stop;
    this.turn = { text: '', toolCalls: [], stopReason: '' };
  }

  close() {
    this.child.kill();
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    this.write({ id, method, params });
    return new Promise((done, fail) => this.waiting.set(id, { done, fail }));
  }

  notify(method: string, params: unknown) {
    this.write({ method, params });
  }

  result(): AcpTurn {
    return this.turn;
  }

  private write(msg: unknown) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...(msg as object) })}\n`);
  }

  private receive(msg: Message) {
    if (msg.method === undefined) {
      this.settle(msg);
      return;
    }

    if (msg.method === 'session/update') {
      this.record((msg.params as { update: AcpUpdate }).update);
      return;
    }

    if (msg.method === 'session/request_permission') {
      void this.askUser(msg.id as number, msg.params as PermissionParams);
      return;
    }

    if (msg.id === undefined) {
      return;
    }

    this.write({ id: msg.id, error: { code: METHOD_NOT_FOUND, message: `Method not found: ${msg.method}` } });
  }

  private async askUser(id: number, params: PermissionParams) {
    const outcome = this.stop.aborted ? CANCELLED : await this.hooks.ask({ title: params.toolCall.title ?? '', options: params.options }, this.stop);
    this.write({ id, result: { outcome } });
  }

  private settle(msg: Message) {
    const waiter = this.waiting.get(msg.id as number);
    if (!waiter) {
      return;
    }

    this.waiting.delete(msg.id as number);
    if (msg.error) {
      waiter.fail(new Error(msg.error.message));
      return;
    }

    waiter.done(msg.result);
  }

  private record(update: AcpUpdate) {
    this.hooks.onUpdate(update);

    if (update.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
      this.turn.text += update.content.text ?? '';
      return;
    }

    if (update.sessionUpdate === 'tool_call' && update.title) {
      this.turn.toolCalls.push(update.title);
    }
  }

  private failAll(e: Error) {
    for (const w of this.waiting.values()) {
      w.fail(e);
    }

    this.waiting.clear();
  }
}

const INITIALIZE = { protocolVersion: ACP_PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } };

const CANCELLED: PermissionOutcome = { outcome: 'cancelled' };

const SILENT: AcpTurnHooks = { onUpdate: () => {}, ask: async () => CANCELLED };

const IDLE_MS = 15 * 60 * 1000;

type Session = { agent: AgentCommand; cwd: string; mcpServers: McpServer[] };

async function withSession<T>(s: Session, hooks: AcpTurnHooks, work: (acp: Connection, session: NewSession) => Promise<T>): Promise<T> {
  const child = spawn(s.agent.command, s.agent.args, { cwd: s.cwd, env: { ...process.env, ...s.agent.env }, stdio: ['pipe', 'pipe', 'inherit'] }) as unknown as ChildProcessWithoutNullStreams;
  const acp = new Connection(child, hooks);

  try {
    await acp.request('initialize', INITIALIZE);
    const session = (await acp.request('session/new', { cwd: s.cwd, mcpServers: s.mcpServers })) as NewSession;
    return await work(acp, session);
  } finally {
    child.kill();
  }
}

export function listAcpModels(agent: AgentCommand, cwd: string): Promise<AgentModels | null> {
  return withSession({ agent, cwd, mcpServers: [] }, SILENT, async (_, session) => {
    const offered = modelsOf(session);
    return offered && { current: offered.current, models: offered.models };
  });
}

type Live = { agentId: string; acp: Connection; session: NewSession; model: string | null; idle: ReturnType<typeof setTimeout> | null };

function launch(s: Session): Promise<{ acp: Connection; session: NewSession }> {
  const child = spawn(s.agent.command, s.agent.args, { cwd: s.cwd, env: { ...process.env, ...s.agent.env }, stdio: ['pipe', 'pipe', 'inherit'] }) as unknown as ChildProcessWithoutNullStreams;
  const acp = new Connection(child, SILENT);

  return (async () => {
    try {
      await acp.request('initialize', INITIALIZE);
      const session = (await acp.request('session/new', { cwd: s.cwd, mcpServers: s.mcpServers })) as NewSession;
      return { acp, session };
    } catch (e) {
      acp.close();
      throw e;
    }
  })();
}

export function createAcpSessions(idleMs = IDLE_MS) {
  const threads = new Map<string, Promise<Live>>();
  const running = new Map<string, AbortController>();

  const close = (thread: string) => {
    const live = threads.get(thread);
    threads.delete(thread);
    void live?.then((l) => l.acp.close(), () => {});
  };

  async function open(input: ThreadTurn, hooks: AcpTurnHooks): Promise<Live> {
    const known = await threads.get(input.thread)?.catch(() => null);
    if (known && known.agentId === input.agentId && !known.acp.exited) {
      return known;
    }

    close(input.thread);
    hooks.onStarting?.();
    const opening = launch(input).then(({ acp, session }): Live => ({ agentId: input.agentId, acp, session, model: modelsOf(session)?.current ?? null, idle: null }));
    threads.set(input.thread, opening);
    opening.catch(() => threads.delete(input.thread));
    return opening;
  }

  async function prompt(live: Live, input: ThreadTurn, stop: AbortSignal): Promise<AcpTurn> {
    const { acp, session } = live;
    const { sessionId } = session;
    const change = switchFor(session, live.model, input.model ?? null);
    if (change) {
      await acp.request(change.method, change.params);
      live.model = input.model ?? live.model;
    }

    if (stop.aborted) {
      return { ...acp.result(), stopReason: CANCELLED.outcome };
    }

    stop.addEventListener('abort', () => acp.notify('session/cancel', { sessionId }), { once: true });
    const { stopReason } = (await acp.request('session/prompt', { sessionId, prompt: [{ type: 'text', text: input.prompt }] })) as { stopReason: string };
    return { ...acp.result(), stopReason };
  }

  return {
    async turn(input: ThreadTurn, hooks: AcpTurnHooks): Promise<AcpTurn> {
      const stop = new AbortController();
      running.set(input.thread, stop);
      hooks.signal?.addEventListener('abort', () => stop.abort(), { once: true });

      try {
        const live = await open(input, hooks);
        if (live.idle) {
          clearTimeout(live.idle);
        }

        live.acp.begin(hooks, stop.signal);
        try {
          return await prompt(live, input, stop.signal);
        } finally {
          live.acp.begin(SILENT, NEVER_ABORTED);
          live.idle = setTimeout(() => close(input.thread), idleMs);
          live.idle.unref();
        }
      } finally {
        running.delete(input.thread);
      }
    },

    cancel(thread: string): boolean {
      const stop = running.get(thread);
      stop?.abort();
      return !!stop;
    },

    closeAll() {
      [...threads.keys()].forEach(close);
    }
  };
}

export const acpSessions = createAcpSessions();
