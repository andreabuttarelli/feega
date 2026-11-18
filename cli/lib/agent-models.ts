import { appUrl, LOCAL_MODE_TOKEN } from './config.ts';

export type AgentModel = { id: string; name: string; description: string | null; efforts?: string[] };

export type ModelListing = { models: AgentModel[] | null; current: string | null; chosen: string | null; effort?: string | null; chosenEffort?: string | null };

const ID_WIDTH = 32;
const NAME_WIDTH = 28;
const NO_CHOICE = 'This agent does not let a client pick its model.';

const endpoint = (agent: string) => `${appUrl()}/api/v1/local/acp/agents/${encodeURIComponent(agent)}/models`;

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${LOCAL_MODE_TOKEN}` } });
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()) || 'the local Feega refused the request'}`);
  }

  return res;
}

export async function listModels(agent: string, { refresh }: { refresh: boolean }): Promise<ModelListing> {
  const res = await call(`${endpoint(agent)}${refresh ? '?refresh=1' : ''}`);
  return (await res.json()) as ModelListing;
}

const save = (agent: string, choice: { model: string | null } | { effort: string | null }) =>
  call(endpoint(agent), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(choice) });

export async function setModel(agent: string, model: string | null): Promise<void> {
  await save(agent, { model });
}

export async function setEffort(agent: string, effort: string | null): Promise<void> {
  await save(agent, { effort });
}

function effortNote(efforts: string[] | undefined, picked: string | null): string {
  if (!efforts?.length) {
    return '';
  }

  return `effort: ${efforts.map((e) => (e === picked ? `*${e}` : e)).join(' ')}`;
}

export function modelLines({ models, current, chosen, effort = null, chosenEffort = null }: ModelListing): string[] {
  if (!models) {
    return [NO_CHOICE];
  }

  const picked = chosen ?? current;
  return models.map((m) => {
    const mark = m.id === picked ? '*' : ' ';
    const note = [m.id === current ? 'agent default' : '', effortNote(m.efforts, chosenEffort ?? effort)].filter(Boolean).join('  ');
    return `${mark} ${m.id.padEnd(ID_WIDTH)} ${m.name.padEnd(NAME_WIDTH)} ${note}`.trimEnd();
  });
}
