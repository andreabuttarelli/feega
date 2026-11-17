import { AcpLaunch, AgentAuth, type DetectedAgent } from './detected-agent';

export enum AgentStatus {
  Ready = 'ready',
  NeedsLogin = 'needs_login',
  SignInUnknown = 'sign_in_unknown',
  NoAcp = 'no_acp',
  NotInstalled = 'not_installed'
}

type StatusRow = { label: string; usable: boolean; copy: (agent: DetectedAgent) => string | null };

export const AGENT_STATUS: Readonly<Record<AgentStatus, StatusRow>> = {
  [AgentStatus.Ready]: { label: 'Ready', usable: true, copy: () => null },
  [AgentStatus.SignInUnknown]: { label: 'Installed', usable: true, copy: () => null },
  [AgentStatus.NeedsLogin]: { label: 'Needs login', usable: true, copy: (a) => a.login },
  [AgentStatus.NoAcp]: { label: 'Needs npx', usable: false, copy: () => null },
  [AgentStatus.NotInstalled]: { label: 'Not installed', usable: false, copy: (a) => a.install }
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
