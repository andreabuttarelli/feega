import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { Refresh, detectCached } from '$lib/server/acp/detect';
import { modelCache } from '$lib/server/acp/model-cache';
import type { ModelListing } from '$lib/acp/agent-models';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const CONFLICT = 409;
const BAD_GATEWAY = 502;
const NO_CONTENT = 204;

function store() {
  const opened = localStore();
  if (!opened) {
    error(NOT_FOUND, 'ACP agents run only in local mode');
  }

  return opened;
}

async function liveModels(agent: string, refresh: Refresh) {
  const detected = (await detectCached(Refresh.Cached)).find((d) => d.agent.id === agent);
  if (!detected) {
    error(NOT_FOUND, 'Unknown agent');
  }

  if (!detected.command) {
    error(CONFLICT, `${detected.agent.name} is not installed here, or cannot run over ACP`);
  }

  try {
    return await modelCache.models(agent, detected.command, refresh);
  } catch (e) {
    error(BAD_GATEWAY, (e as Error).message);
  }
}

export const GET: RequestHandler = async ({ params, url }) => {
  const opened = store();
  const refresh = url.searchParams.has('refresh') ? Refresh.Fresh : Refresh.Cached;
  const live = await liveModels(params.agent, refresh);
  const listing: ModelListing = { models: live?.models ?? null, current: live?.current ?? null, chosen: opened.acpModel(params.agent), effort: live?.effort ?? null, chosenEffort: opened.acpEffort(params.agent) };
  return json(listing);
};

async function saveEffort(agent: string, effort: unknown): Promise<Response> {
  const opened = store();
  if (effort !== null) {
    const live = await liveModels(agent, Refresh.Cached);
    if (!live?.models.some((m) => m.efforts?.includes(effort as string))) {
      error(BAD_REQUEST, 'effort must be one the agent offers, or null');
    }
  }

  opened.chooseAcpEffort(agent, effort as string | null);
  return new Response(null, { status: NO_CONTENT });
}

export const PUT: RequestHandler = async ({ params, request }) => {
  const opened = store();
  const body = (await request.json()) as { model?: unknown; effort?: unknown };
  if ('effort' in body) {
    return saveEffort(params.agent, body.effort);
  }

  const { model } = body;
  if (model === null) {
    opened.chooseAcpModel(params.agent, null);
    return new Response(null, { status: NO_CONTENT });
  }

  const live = await liveModels(params.agent, Refresh.Cached);
  if (!live?.models.some((m) => m.id === model)) {
    error(BAD_REQUEST, 'model must be one the agent offers, or null');
  }

  opened.chooseAcpModel(params.agent, model as string);
  return new Response(null, { status: NO_CONTENT });
};
