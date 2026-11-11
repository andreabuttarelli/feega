import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

export const ACP_PROTOCOL_VERSION = 1;

export type AgentCommand = { command: string; args: string[]; env?: Record<string, string> };

export type McpServer = { name: string; command: string; args: string[]; env: { name: string; value: string }[] };

export type AcpTurnInput = { agent: AgentCommand; cwd: string; mcpServers: McpServer[]; prompt: string };

export type AcpTurn = { text: string; toolCalls: string[]; stopReason: string };

type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } };

type PermissionOption = { optionId: string; kind: string };

type SessionUpdate = { sessionUpdate: string; content?: { type: string; text?: string }; title?: string };

const ALLOW_ONCE = 'allow_once';

class Connection {
  private nextId = 1;
  private readonly waiting = new Map<number, { done: (v: unknown) => void; fail: (e: Error) => void }>();
  private readonly turn: AcpTurn = { text: '', toolCalls: [], stopReason: '' };

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    createInterface({ input: child.stdout }).on('line', (line) => this.receive(JSON.parse(line) as Message));
    child.on('error', (e) => this.failAll(e));
    child.on('exit', (code) => this.failAll(new Error(`ACP agent exited with code ${code}`)));
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    this.write({ id, method, params });
    return new Promise((done, fail) => this.waiting.set(id, { done, fail }));
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
      this.record((msg.params as { update: SessionUpdate }).update);
      return;
    }

    if (msg.method === 'session/request_permission') {
      const options = (msg.params as { options: PermissionOption[] }).options;
      const allow = options.find((o) => o.kind === ALLOW_ONCE);
      this.write({ id: msg.id, result: { outcome: allow ? { outcome: 'selected', optionId: allow.optionId } : { outcome: 'cancelled' } } });
      return;
    }

    this.write({ id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
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

  private record(update: SessionUpdate) {
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

export async function runAcpTurn(input: AcpTurnInput): Promise<AcpTurn> {
  const child = spawn(input.agent.command, input.agent.args, { cwd: input.cwd, env: { ...process.env, ...input.agent.env }, stdio: ['pipe', 'pipe', 'inherit'] }) as unknown as ChildProcessWithoutNullStreams;
  const acp = new Connection(child);

  try {
    await acp.request('initialize', { protocolVersion: ACP_PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
    const { sessionId } = (await acp.request('session/new', { cwd: input.cwd, mcpServers: input.mcpServers })) as { sessionId: string };
    const { stopReason } = (await acp.request('session/prompt', { sessionId, prompt: [{ type: 'text', text: input.prompt }] })) as { stopReason: string };
    return { ...acp.result(), stopReason };
  } finally {
    child.kill();
  }
}
