import { readFile } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import { inside } from '@feega/live-edit/live-ask';
import { AiState, ToView, type ViewMessage } from '../../messages';
import type { AgentEnv } from '../agents';
import { AcpId, acpAgents, launchOf } from './acp-agents';
import { AgentEventKind, type AgentEvent, type AgentFiles, type AgentSession, type OpenAgent } from './agent-session';

const OUTSIDE = 'is outside the workspace';
const NOT_STARTED = 'start an agent first';
const ADAPTER_ACTION = 'Run adapter';

export type AiChatDeps = {
  root: () => string;
  env: () => AgentEnv;
  open: OpenAgent;
  confirm: (question: string, yes: string) => Promise<boolean>;
  post: (message: ViewMessage) => unknown;
  write: (path: string, content: string, agent: string) => Promise<void>;
};

const adapterPackage = (id: AcpId): string => launchOf(id).args.find((arg) => arg.startsWith('@')) ?? launchOf(id).command;

const slice = (text: string, from?: number, count?: number): string => {
  if (from === undefined && count === undefined) {
    return text;
  }
  const start = Math.max((from ?? 1) - 1, 0);
  return text.split('\n').slice(start, count === undefined ? undefined : start + count).join('\n');
};

export function aiChat(deps: AiChatDeps) {
  const { post } = deps;
  const adapted = new Set<AcpId>();
  let current: { id: AcpId; label: string; session: AgentSession } | null = null;

  const state = (next: AiState) => post({ kind: ToView.AiState, state: next, agent: current?.id });
  const emit = (event: AgentEvent) => post({ kind: ToView.AiEvent, event });

  const failed = (reason: string) => emit({ kind: AgentEventKind.Failed, reason });

  const inRoot = (path: string): string => {
    const rel = isAbsolute(path) ? relative(deps.root(), path) : path;
    if (!inside(deps.root(), rel)) {
      throw new Error(`${path} ${OUTSIDE}`);
    }
    return rel;
  };

  const files = (label: () => string): AgentFiles => ({
    read: async (path, from, count) => slice(await readFile(`${deps.root()}/${inRoot(path)}`, 'utf8'), from, count),
    write: (path, content) => deps.write(inRoot(path), content, label())
  });

  const closed = () => {
    current?.session.close();
    current = null;
  };

  const heard = (event: AgentEvent) => {
    emit(event);
    if (event.kind === AgentEventKind.Done) {
      state(AiState.Ready);
    }
    if (event.kind === AgentEventKind.Failed) {
      current = null;
      state(AiState.Idle);
    }
  };

  async function start(id: AcpId) {
    const agent = acpAgents(deps.env()).find((a) => a.id === id);
    if (!agent) {
      return;
    }
    if (!agent.installed) {
      failed(`${agent.label} is not installed. Install it with: ${agent.install}`);
      return;
    }
    if (agent.adapter && !adapted.has(id) && !(await deps.confirm(`Feega will run ${adapterPackage(id)} with npx to talk to ${agent.label}. Continue?`, ADAPTER_ACTION))) {
      return;
    }
    adapted.add(id);
    closed();
    state(AiState.Starting);
    try {
      const session = await deps.open(launchOf(id), { cwd: deps.root(), files: files(() => agent.label), emit: heard });
      current = { id, label: agent.label, session };
      state(AiState.Ready);
    } catch (error) {
      failed(error instanceof Error ? error.message : String(error));
      state(AiState.Idle);
    }
  }

  async function send(text: string, context: string | null) {
    if (!current) {
      failed(NOT_STARTED);
      return;
    }
    state(AiState.Busy);
    await current.session.send(context ? `${context}\n\n${text}` : text);
  }

  return {
    list: () => post({ kind: ToView.AiAgents, agents: acpAgents(deps.env()) }),
    start,
    send,
    cancel: async () => void (await current?.session.cancel()),
    answer: (id: string, optionId: string | null) => current?.session.answer(id, optionId),
    close: closed
  };
}
