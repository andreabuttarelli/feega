import type { ToolCall, ToolStatus } from '$lib/components/brand-agent/chat-view';
import { AcpEventKind, readAcpEvents, type AcpEvent, type AcpOption, type AcpUpdate } from './acp-events';

export const ACP_ENDPOINT = '/api/v1/local/acp';

export enum Line {
  User = 'user',
  Agent = 'agent',
  Plan = 'plan',
  Permission = 'permission',
  Stopped = 'stopped',
  Error = 'error'
}

export type PlanStep = { content: string; status: string };

export type AgentLine = { line: Line.Agent; text: string; reasoning: string; tools: ToolCall[] };

export type ChatLine =
  | { line: Line.User | Line.Error; text: string }
  | AgentLine
  | { line: Line.Plan; entries: PlanStep[] }
  | { line: Line.Stopped }
  | { line: Line.Permission; id: string; title: string; options: AcpOption[]; chosen: string | null };

type PermissionLine = Extract<ChatLine, { line: Line.Permission }>;

enum Step {
  Any = 'any',
  BeforeText = 'before_text'
}

const ABORT_ERROR = 'AbortError';
const CANCELLED = 'cancelled';
const ANSWER_FAILED = 'The agent did not get your answer. Try again.';

const TOOL_STATUS: Record<string, ToolStatus> = {
  pending: 'running',
  in_progress: 'running',
  completed: 'done',
  failed: 'error'
};

const textOf = (u: AcpUpdate) => (u.content?.type === 'text' ? (u.content.text ?? '') : '');

const UPDATE_LINES: Record<string, (update: AcpUpdate, chat: AcpChat) => void> = {
  agent_message_chunk: (u, chat) => {
    chat.step().text += textOf(u);
  },
  agent_thought_chunk: (u, chat) => {
    chat.step(Step.BeforeText).reasoning += textOf(u);
  },
  tool_call: (u, chat) => {
    chat.step(Step.BeforeText).tools.push({ toolCallId: u.toolCallId, toolName: u.title ?? '', status: TOOL_STATUS[u.status ?? 'pending'], input: u.rawInput, output: u.rawOutput });
  },
  tool_call_update: (u, chat) => chat.updateTool(u),
  plan: (u, chat) => chat.showPlan((u.entries ?? []).map((e) => ({ content: e.content, status: e.status })))
};

export class AcpChat {
  lines = $state<ChatLine[]>([]);
  busy = $state(false);
  starting = $state(false);
  revision = $state(0);
  thread = $state(crypto.randomUUID());
  private turn: AbortController | null = null;

  constructor(public fetcher: typeof fetch = fetch) {}

  push(line: ChatLine) {
    this.revision += 1;
    this.lines.push(line);
  }

  step(when: Step = Step.Any): AgentLine {
    const last = this.lines.at(-1);
    if (last?.line === Line.Agent && (when === Step.Any || !last.text)) {
      return last;
    }

    this.push({ line: Line.Agent, text: '', reasoning: '', tools: [] });
    return this.lines.at(-1) as AgentLine;
  }

  updateTool(u: AcpUpdate) {
    const call = this.lines.flatMap((l) => (l.line === Line.Agent ? l.tools : [])).find((t) => t.toolCallId === u.toolCallId);
    if (!call) {
      return;
    }

    call.toolName = u.title ?? call.toolName;
    call.status = u.status ? TOOL_STATUS[u.status] : call.status;
    call.input = u.rawInput ?? call.input;
    call.output = u.rawOutput ?? call.output;
  }

  showPlan(entries: PlanStep[]) {
    const plan = this.lines.findLastIndex((l) => l.line === Line.Plan);
    const asked = this.lines.findLastIndex((l) => l.line === Line.User);
    if (plan > asked) {
      this.lines[plan] = { line: Line.Plan, entries };
      return;
    }

    this.push({ line: Line.Plan, entries });
  }

  restart() {
    if (this.busy) {
      return;
    }

    this.lines = [];
    this.thread = crypto.randomUUID();
  }

  async send(agent: string, prompt: string) {
    this.push({ line: Line.User, text: prompt });
    this.busy = true;
    this.turn = new AbortController();

    try {
      const res = await this.post({ thread: this.thread, agent, prompt }, this.turn.signal);
      for await (const event of readAcpEvents(res.body!)) {
        this.receive(event);
      }
    } catch (e) {
      this.push((e as Error).name === ABORT_ERROR ? { line: Line.Stopped } : { line: Line.Error, text: (e as Error).message });
    }

    this.turn = null;
    this.busy = false;
    this.starting = false;
  }

  async stop() {
    const turn = this.turn;
    if (!turn) {
      return;
    }

    const res = await this.post({ cancel: this.thread }).catch(() => null);
    if (!res?.ok) {
      turn.abort();
    }
  }

  async answer(id: string, optionId: string) {
    const asked = this.lines.find((l): l is PermissionLine => l.line === Line.Permission && l.id === id);
    if (!asked || asked.chosen !== null) {
      return;
    }

    asked.chosen = optionId;
    const res = await this.post({ permission: { id, optionId } }).catch(() => null);
    if (res?.ok) {
      return;
    }

    asked.chosen = null;
    this.push({ line: Line.Error, text: ANSWER_FAILED });
  }

  private receive(event: AcpEvent) {
    this.revision += 1;
    this.starting = event.kind === AcpEventKind.Starting;

    if (event.kind === AcpEventKind.Update) {
      UPDATE_LINES[event.update.sessionUpdate]?.(event.update, this);
      return;
    }

    if (event.kind === AcpEventKind.Permission) {
      this.push({ line: Line.Permission, id: event.id, title: event.title, options: event.options, chosen: null });
      return;
    }

    if (event.kind === AcpEventKind.Done && event.stopReason === CANCELLED) {
      this.push({ line: Line.Stopped });
      return;
    }

    if (event.kind === AcpEventKind.Failed) {
      this.push({ line: Line.Error, text: event.message });
    }
  }

  private post(body: unknown, signal?: AbortSignal) {
    return this.fetcher(ACP_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  }
}
