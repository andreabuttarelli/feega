import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '$lib/server/db/connect';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { Db } from '$lib/server/db/client';
import { nodeBoxes, type NodeBoxRow } from '$lib/server/repos/canvas';
import { runInBackground } from '$lib/server/background-work';
import { currentLane } from '$lib/server/agents/agent-lane';
import { CHAT_AGENT_KEY } from '$lib/canvas/history/timeline';
import { AGENT_IDLE_MS, CANVAS_PEER_EVENT, type CanvasMark } from '$lib/realtime/canvas-presence';
import { agentMark, type AgentIdentity } from '$lib/realtime/agent-presence';

export type NodeBox = NodeBoxRow;

export type AgentScope = { db: Db; orgId: string; userId: string; agentKey?: string | null; sessionId?: string | null };

export type AgentPorts = {
  enabled: () => boolean;
  boxes: (scope: AgentScope, ids: string[]) => Promise<NodeBox[]>;
  send: (canvasId: string, mark: CanvasMark) => Promise<void>;
  now: () => number;
  later: (run: () => void, ms: number) => void;
  lane: () => string | null;
};

export const AGENT_SEND_GAP_MS = 150;
const MAX_GATES = 500;
const FALLBACK_NAME = 'Agent';
const SEND_TIMEOUT_MS = 1500;
const USE_PATH = 'src/lib/server/canvas/agent-cursor.ts';

const AGENT_NAMES: Record<string, string> = {
  [CHAT_AGENT_KEY]: 'Claude',
  mcp: 'MCP agent',
  motion: 'Claude · motion',
  compose: 'Claude · layout',
  studio: 'Studio',
  api: 'API agent'
};

const NODE_KEYS = ['nodeId', 'nodeIds', 'frameId', 'frameIds', 'sourceId', 'targetId', 'sourceNodeId', 'targetNodeId', 'into'];

export function agentIdentity(scope: Pick<AgentScope, 'userId' | 'agentKey' | 'sessionId'>, lane: string | null): AgentIdentity {
  const key = scope.agentKey ?? '';
  const base = AGENT_NAMES[key] ?? FALLBACK_NAME;
  const id = `agent:${key}:${scope.sessionId ?? scope.userId}`;
  return lane ? { id: `${id}:${lane}`, name: `${base} · ${lane}` } : { id, name: base };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function idsIn(record: unknown): unknown[] {
  if (!isRecord(record)) {
    return [];
  }
  const listed = NODE_KEYS.flatMap((key) => [record[key]].flat());
  return isRecord(record.node) ? [...listed, record.node.id] : listed;
}

const isId = (id: unknown): id is string => typeof id === 'string' && id.length > 0;

export const touchedNodes = (input: unknown, result: unknown): string[] => [...new Set([...idsIn(input), ...idsIn(result)].filter(isId))];

type Work = { agent: AgentIdentity; boxes: NodeBox[]; doing: string };

type Gate = { lastAt: number; pending: Work | null };

function byCanvas(boxes: NodeBox[]): Map<string, NodeBox[]> {
  const groups = new Map<string, NodeBox[]>();
  for (const box of boxes) {
    groups.set(box.canvasId, [...(groups.get(box.canvasId) ?? []), box]);
  }
  return groups;
}

export function agentPresence(ports: AgentPorts) {
  const gates = new Map<string, Gate>();

  async function sendAll(work: Work, at: number) {
    const sends = [...byCanvas(work.boxes)].map(([canvasId, boxes]) => ports.send(canvasId, agentMark(work.agent, { boxes, doing: work.doing }, at)).catch(() => {}));
    await Promise.all(sends);
  }

  function prune(now: number) {
    if (gates.size < MAX_GATES) {
      return;
    }
    for (const [id, gate] of gates) {
      if (!gate.pending && now - gate.lastAt > AGENT_IDLE_MS) {
        gates.delete(id);
      }
    }
  }

  function flush(id: string) {
    const gate = gates.get(id);
    if (!gate?.pending) {
      return;
    }
    const work = gate.pending;
    gate.pending = null;
    gate.lastAt = ports.now();
    void sendAll(work, gate.lastAt);
  }

  async function publish(work: Work) {
    const now = ports.now();
    const gate = gates.get(work.agent.id);
    if (!gate || now - gate.lastAt >= AGENT_SEND_GAP_MS) {
      prune(now);
      gates.set(work.agent.id, { lastAt: now, pending: null });
      await sendAll(work, now);
      return;
    }

    const waiting = !!gate.pending;
    gate.pending = work;
    if (!waiting) {
      ports.later(() => flush(work.agent.id), AGENT_SEND_GAP_MS - (now - gate.lastAt));
    }
  }

  return {
    touched: async (scope: AgentScope, nodeIds: string[], doing: string): Promise<void> => {
      if (!scope.agentKey || !nodeIds.length || !ports.enabled()) {
        return;
      }

      const boxes = await ports.boxes(scope, [...new Set(nodeIds)]).catch(() => []);
      if (!boxes.length) {
        return;
      }

      await publish({ agent: agentIdentity(scope, ports.lane()), boxes, doing: doing.replaceAll('_', ' ') });
    }
  };
}

let broadcaster: SupabaseClient | null = null;

function serviceClient(): SupabaseClient {
  if (!SERVICE_ROLE_USES.some((use) => use.path.startsWith(USE_PATH))) {
    throw new Error(`service role senza voce nel registro: ${USE_PATH}`);
  }
  broadcaster ??= createClient(publicEnv.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return broadcaster;
}

async function broadcast(canvasId: string, mark: CanvasMark): Promise<void> {
  const client = serviceClient();
  const channel = client.channel(`canvas:${canvasId}`, { config: { private: true } });
  try {
    await channel.httpSend(CANVAS_PEER_EVENT, mark, { timeout: SEND_TIMEOUT_MS });
  } finally {
    await client.removeChannel(channel);
  }
}

const livePorts: AgentPorts = {
  enabled: () => !!publicEnv.PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY,
  boxes: (scope, ids) => nodeBoxes(scope.db, { orgId: scope.orgId, nodeIds: ids }),
  send: broadcast,
  now: Date.now,
  later: (run, ms) => void setTimeout(run, ms),
  lane: currentLane
};

export const agentWork = agentPresence(livePorts);

export function showAgentAt(scope: AgentScope, nodeIds: string[], doing: string): void {
  if (!scope.agentKey || !nodeIds.length) {
    return;
  }
  runInBackground(() => agentWork.touched(scope, nodeIds, doing), 'agent-cursor');
}
