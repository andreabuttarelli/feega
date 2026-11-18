import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { AGENT_CATALOG, Refresh, detectCached } from '$lib/server/acp/detect';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const NO_CONTENT = 204;

function store() {
  const opened = localStore();
  if (!opened) {
    error(NOT_FOUND, 'ACP agents run only in local mode');
  }

  return opened;
}

export const GET: RequestHandler = async ({ url }) => {
  const opened = store();
  const refresh = url.searchParams.has('refresh') ? Refresh.Fresh : Refresh.Cached;
  const detected = await detectCached(refresh);
  return json({ agents: detected.map((d) => d.agent), chosen: opened.acpAgent() });
};

export const PUT: RequestHandler = async ({ request }) => {
  const opened = store();
  const { agent } = (await request.json()) as { agent?: unknown };
  const known = agent === null || AGENT_CATALOG.some((row) => row.id === agent);
  if (!known) {
    error(BAD_REQUEST, 'agent must be a catalog id or null');
  }

  opened.chooseAcpAgent(agent as string | null);
  return new Response(null, { status: NO_CONTENT });
};
