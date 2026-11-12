import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { AcpOption, AcpUpdate } from '$lib/acp/acp-events';

export const ACP_PROTOCOL_VERSION = 1;

export type AgentCommand = { command: string; args: string[]; env?: Record<string, string> };

export type McpServer = { name: string; command: string; args: string[]; env: { name: string; value: string }[] };

export type AcpTurnInput = { agent: AgentCommand; cwd: string; mcpServers: McpServer[]; prompt: string };

export type AcpTurn = { text: string; toolCalls: string[]; stopReason: string };

type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } };

export type PermissionAsk = { title: string; options: AcpOption[] };

export type PermissionOutcome = { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' };

export type AcpTurnHooks = { onUpdate: (update: AcpUpdate) => void; ask: (permission: PermissionAsk) => Promise<PermissionOutcome>; signal?: AbortSignal };

const METHOD_NOT_FOUND = -32601;

type PermissionParams = { toolCall: { title?: string }; options: AcpOption[] };

class Connection {
  private nextId = 1;
  private readonly waiting = new Map<number, { done: (v: unknown) => void; fail: (e: Error) => void }>();
  private readonly turn: AcpTurn = { text: '', toolCalls: [], stopReason: '' };

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly hooks: AcpTurnHooks
  ) {
    createInterface({ input: child.stdout }).on('line', (line) => this.receive(JSON.parse(line) as Message));
    child.on('error', (e) => this.failAll(e));
    child.on('exit', (code) => this.failAll(new Error(`ACP agent exited with code ${code}`)));
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
    const outcome = await this.hooks.ask({ title: params.toolCall.title ?? '', options: params.options });
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

export async function runAcpTurn(input: AcpTurnInput, hooks: AcpTurnHooks): Promise<AcpTurn> {
  const child = spawn(input.agent.command, input.agent.args, { cwd: input.cwd, env: { ...process.env, ...input.agent.env }, stdio: ['pipe', 'pipe', 'inherit'] }) as unknown as ChildProcessWithoutNullStreams;
  const acp = new Connection(child, hooks);

  try {
    await acp.request('initialize', { protocolVersion: ACP_PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
    const { sessionId } = (await acp.request('session/new', { cwd: input.cwd, mcpServers: input.mcpServers })) as { sessionId: string };
    hooks.signal?.addEventListener('abort', () => acp.notify('session/cancel', { sessionId }), { once: true });
    const { stopReason } = (await acp.request('session/prompt', { sessionId, prompt: [{ type: 'text', text: input.prompt }] })) as { stopReason: string };
    return { ...acp.result(), stopReason };
  } finally {
    child.kill();
  }
}
