import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { ACP_AGENTS, feegaMcp, isAcpAgent } from '$lib/server/acp/agents';
import { runAcpTurn } from '$lib/server/acp/client';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const LOCAL_APP_URL = 'http://127.0.0.1:5173';

export const POST: RequestHandler = async ({ request }) => {
  if (localStore() === null) {
    error(NOT_FOUND, 'ACP agents run only in local mode');
  }

  const { agent, prompt } = (await request.json()) as { agent?: unknown; prompt?: unknown };
  if (!isAcpAgent(agent) || typeof prompt !== 'string') {
    error(BAD_REQUEST, 'agent and prompt are required');
  }

  const turn = await runAcpTurn({
    agent: ACP_AGENTS[agent],
    cwd: process.cwd(),
    mcpServers: [feegaMcp(process.cwd(), process.env.PUBLIC_APP_URL ?? LOCAL_APP_URL)],
    prompt
  });

  return json(turn);
};
