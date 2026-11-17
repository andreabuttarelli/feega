export enum AgentAuth {
  SignedIn = 'signed_in',
  NeedsLogin = 'needs_login',
  Unknown = 'unknown'
}

export enum AcpLaunch {
  Native = 'native',
  Adapter = 'adapter',
  None = 'none'
}

export type DetectedAgent = {
  id: string;
  name: string;
  installed: boolean;
  version: string | null;
  launch: AcpLaunch;
  auth: AgentAuth;
  install: string;
  login: string | null;
};

export const ACP_AGENTS_ENDPOINT = '/api/v1/local/acp/agents';
