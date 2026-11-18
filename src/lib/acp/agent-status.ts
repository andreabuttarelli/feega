import { AcpLaunch, AgentAuth, type DetectedAgent } from './detected-agent';

export enum AgentStatus {
  Ready = 'ready',
  NeedsLogin = 'needs_login',
  SignInUnknown = 'sign_in_unknown',
  NoAcp = 'no_acp',
  NotInstalled = 'not_installed'
}

type StatusRow = { tip: string | null; usable: boolean; rank: number };

export const AGENT_STATUS: Readonly<Record<AgentStatus, StatusRow>> = {
  [AgentStatus.Ready]: { tip: null, usable: true, rank: 0 },
  [AgentStatus.SignInUnknown]: { tip: null, usable: true, rank: 0 },
  [AgentStatus.NeedsLogin]: { tip: 'Sign in from your terminal', usable: true, rank: 1 },
  [AgentStatus.NoAcp]: { tip: 'Needs npx', usable: false, rank: 2 },
  [AgentStatus.NotInstalled]: { tip: 'Not installed', usable: false, rank: 3 }
};

const AUTH_STATUS: Readonly<Record<AgentAuth, AgentStatus>> = {
  [AgentAuth.SignedIn]: AgentStatus.Ready,
  [AgentAuth.Unknown]: AgentStatus.SignInUnknown,
  [AgentAuth.NeedsLogin]: AgentStatus.NeedsLogin
};

export function statusOf(agent: DetectedAgent): AgentStatus {
  if (!agent.installed) {
    return AgentStatus.NotInstalled;
  }

  if (agent.launch === AcpLaunch.None) {
    return AgentStatus.NoAcp;
  }

  return AUTH_STATUS[agent.auth];
}

export function readyFirst(agents: DetectedAgent[]): DetectedAgent[] {
  return [...agents].sort((a, b) => AGENT_STATUS[statusOf(a)].rank - AGENT_STATUS[statusOf(b)].rank);
}
