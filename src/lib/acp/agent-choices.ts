import { localStore } from '$lib/browser-storage';

export enum AcpAgent {
  Claude = 'claude',
  Codex = 'codex',
  Gemini = 'gemini'
}

export const ACP_AGENT_LABELS: Readonly<Record<AcpAgent, string>> = {
  [AcpAgent.Claude]: 'Claude Code',
  [AcpAgent.Codex]: 'Codex',
  [AcpAgent.Gemini]: 'Gemini CLI'
};

export const isAcpAgent = (key: unknown): key is AcpAgent => Object.values(AcpAgent).includes(key as AcpAgent);

const AGENT_KEY = 'feega.acpAgent';

export function readAcpAgent(): AcpAgent | null {
  const stored = localStore()?.getItem(AGENT_KEY);
  return isAcpAgent(stored) ? stored : null;
}

export function writeAcpAgent(agent: AcpAgent | null) {
  if (agent === null) {
    localStore()?.removeItem(AGENT_KEY);
    return;
  }

  localStore()?.setItem(AGENT_KEY, agent);
}
