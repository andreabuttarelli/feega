import type { AcpAgent, AcpId } from '../host/ai/acp-agents';
import { markOf, type AgentMark } from './ai-view';

export enum Detection {
  Detected = 'detected',
  NotFound = 'not-found'
}

export type AgentRow = { id: AcpId; label: string; state: Detection; mark: AgentMark };

export type Overview = { rows: AgentRow[]; none: boolean };

const row = (agent: AcpAgent): AgentRow => ({ id: agent.id, label: agent.label, state: agent.installed ? Detection.Detected : Detection.NotFound, mark: markOf(agent.id, agent.label) });

export function overviewOf(agents: AcpAgent[]): Overview {
  const rows = agents.map(row);
  const detected = rows.filter((r) => r.state === Detection.Detected);

  return { rows: [...detected, ...rows.filter((r) => r.state === Detection.NotFound)], none: detected.length === 0 };
}
