import { appUrl, LOCAL_MODE_TOKEN } from './config.ts';

export type Agent = {
  id: string;
  name: string;
  installed: boolean;
  version: string | null;
  launch: 'native' | 'adapter' | 'none';
  auth: 'signed_in' | 'needs_login' | 'unknown';
  install: string;
  login: string | null;
};

export type AgentListing = { agents: Agent[]; chosen: string | null };

const ENDPOINT = '/api/v1/local/acp/agents';
const NAME_WIDTH = 20;
const VERSION_WIDTH = 22;

export async function listAgents({ refresh }: { refresh: boolean }): Promise<AgentListing> {
  const res = await fetch(`${appUrl()}${ENDPOINT}${refresh ? '?refresh=1' : ''}`, { headers: { authorization: `Bearer ${LOCAL_MODE_TOKEN}` } });
  if (!res.ok) {
    throw new Error(`${res.status}: agent detection runs only on a local Feega (feega local <file>.feega)`);
  }

  return (await res.json()) as AgentListing;
}

function status(agent: Agent): { label: string; copy: string | null } {
  if (!agent.installed) {
    return { label: 'not installed', copy: agent.install };
  }

  if (agent.launch === 'none') {
    return { label: 'needs npx', copy: null };
  }

  if (agent.auth === 'needs_login') {
    return { label: 'needs login', copy: agent.login };
  }

  return { label: agent.auth === 'signed_in' ? 'ready' : 'installed', copy: null };
}

export function agentLines({ agents, chosen }: AgentListing): string[] {
  return agents.flatMap((agent) => {
    const { label, copy } = status(agent);
    const mark = agent.id === chosen ? '*' : ' ';
    const line = `${mark} ${agent.name.padEnd(NAME_WIDTH)} ${(agent.version ?? '-').padEnd(VERSION_WIDTH)} ${label}`;
    return copy ? [line, `    $ ${copy}`] : [line];
  });
}
