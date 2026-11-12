import { CHAT_AGENT_KEY } from '$lib/canvas/history/timeline';
/**
 * CHI HA FATTO COSA: la coppia che ogni scrittura porta addosso.
 *
 * Un agente non è una persona: `kind` dice come è stata fatta la cosa, `id` resta per conto di
 * chi (la persona di cui l'agente ha la chiave — paga e autorizza), `agentKey` quale agente.
 * Vive qui e non in ogni repository perché la stessa triade si ripeterebbe uguale e divergerebbe
 * al primo campo aggiunto.
 */
export const ACTOR_KINDS = ['user', 'agent', 'system'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export enum AgentKey {
  Sidebar = 'sidebar',
  Mcp = 'mcp',
  Motion = 'motion',
  Api = 'api',
  ApiKey = 'api_key',
  Compose = 'compose',
  Studio = 'studio',
  Loop = 'loop',
  Workflow = 'workflow'
}

export enum Initiator {
  Agent = 'agent',
  Person = 'person'
}

export const AGENT_INITIATOR: Record<AgentKey, Initiator> = {
  [AgentKey.Sidebar]: Initiator.Agent,
  [AgentKey.Mcp]: Initiator.Agent,
  [AgentKey.Motion]: Initiator.Agent,
  [AgentKey.Api]: Initiator.Agent,
  [AgentKey.ApiKey]: Initiator.Agent,
  [AgentKey.Compose]: Initiator.Person,
  [AgentKey.Studio]: Initiator.Person,
  [AgentKey.Loop]: Initiator.Person,
  [AgentKey.Workflow]: Initiator.Person
};

export const AGENT_DECIDED_KEYS: readonly AgentKey[] = Object.values(AgentKey).filter((key) => AGENT_INITIATOR[key] === Initiator.Agent);

export const SIDEBAR_AGENT_KEY = CHAT_AGENT_KEY as AgentKey.Sidebar;

export type AgentActor = { kind: 'agent'; id: string; agentKey: AgentKey; sessionId?: string | null };

type PersonActor = { kind: 'user' | 'system'; id: string | null; agentKey?: null; sessionId?: string | null };

export type Actor = AgentActor | PersonActor;

export type RecordedActor = { kind: ActorKind; id: string | null; agentKey?: string | null };

/** Colonne actor sulle tabelle che hanno anche `agent_key` (nodes, chat, ai_calls). */
export function actorCols(actor: Actor | undefined): Record<string, unknown> {
  if (!actor) {
    return {};
  }
  return {
    actor_kind: actor.kind,
    actor_id: actor.id,
    agent_key: actor.agentKey ?? null
  };
}

/** Colonne actor su `nodes_connections`: la tabella non ha `agent_key`. */
export function edgeActorCols(actor: Actor | undefined): Record<string, unknown> {
  if (!actor) {
    return {};
  }
  return { actor_kind: actor.kind, actor_id: actor.id };
}

export function agentActor(userId: string, agentKey: AgentKey = SIDEBAR_AGENT_KEY, sessionId?: string | null): AgentActor {
  return { kind: 'agent', id: userId, agentKey, ...(sessionId ? { sessionId } : {}) };
}
