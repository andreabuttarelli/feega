import { UsageKind, type UsageDims } from '../usage';
import { AgentEventKind, type AgentEvent } from './agent-session';

const FAILED_CLASS = 'agent_failed';
const OTHER_TOOL = 'other';
const VALUE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:/[\]-]{0,63}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const REPLY_EVENTS = [AgentEventKind.Text, AgentEventKind.Thought, AgentEventKind.Tool];

type Track = (kind: UsageKind, extra?: UsageDims) => unknown;

type Running = {
  agent: string;
  startedAt: number;
  messages: number;
  sentAt: number | null;
  tools: Set<string>;
  allows: Map<string, Map<string, boolean>>;
};

export function aiUsage(usage: { track: Track }, now: () => number = Date.now) {
  let running: Running | null = null;

  function ended() {
    if (!running) {
      return;
    }
    usage.track(UsageKind.AiSessionEnded, { agent: running.agent, message_count: running.messages, tool_count: running.tools.size, duration_ms: now() - running.startedAt });
    running = null;
  }

  function started(agent: string) {
    ended();
    running = { agent, startedAt: now(), messages: 0, sentAt: null, tools: new Set(), allows: new Map() };
    usage.track(UsageKind.AiAgentChosen, { agent });
    usage.track(UsageKind.AiSessionStarted, { agent });
  }

  function sent() {
    if (!running) {
      return;
    }
    running.messages++;
    running.sentAt = now();
    usage.track(UsageKind.AiMessageSent, { agent: running.agent });
  }

  function heard(event: AgentEvent) {
    if (!running) {
      return;
    }
    const { agent } = running;
    if (running.sentAt !== null && REPLY_EVENTS.includes(event.kind)) {
      usage.track(UsageKind.AiFirstResponse, { agent, duration_ms: now() - running.sentAt });
      running.sentAt = null;
    }
    if (event.kind === AgentEventKind.Tool && !running.tools.has(event.tool.id)) {
      running.tools.add(event.tool.id);
      usage.track(UsageKind.AiToolCall, { agent, tool: IDENTIFIER.test(event.tool.kind) ? event.tool.kind : OTHER_TOOL });
    }
    if (event.kind === AgentEventKind.Permission) {
      running.allows.set(event.id, new Map(event.options.map((option) => [option.id, option.allows])));
    }
    if (event.kind === AgentEventKind.Failed) {
      usage.track(UsageKind.AiSessionError, { agent, error_class: FAILED_CLASS });
    }
  }

  function answered(id: string, optionId: string | null) {
    if (!running) {
      return;
    }
    const allowed = optionId !== null && running.allows.get(id)?.get(optionId) === true;
    usage.track(UsageKind.AiPermission, { agent: running.agent, outcome: allowed ? 'allow' : 'reject' });
  }

  function cancelled() {
    if (running) {
      usage.track(UsageKind.AiCancel, { agent: running.agent });
    }
  }

  function configured(category: string, value: string) {
    if (running) {
      usage.track(UsageKind.AiConfigChanged, { agent: running.agent, category, choice: VALUE_ID.test(value) ? value : OTHER_TOOL });
    }
  }

  return { started, configured, sent, heard, answered, cancelled, ended };
}
