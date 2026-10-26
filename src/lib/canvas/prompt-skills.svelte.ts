import type { PromptSkill } from './prompt-skills';

type Shelf = { list: PromptSkill[] };

const shelves = new Map<string, Shelf>();

const endpoint = (projectId: string) => `/api/v1/projects/${projectId}/agent/prompt-skills`;

async function load(projectId: string, shelf: Shelf) {
  const res = await fetch(endpoint(projectId)).catch(() => null);
  if (!res?.ok) {
    return;
  }

  const body = (await res.json()) as { skills?: PromptSkill[] };
  shelf.list = body.skills ?? [];
}

export function promptSkillsOf(projectId: string | undefined): Shelf {
  const key = projectId ?? '';
  const existing = shelves.get(key);
  if (existing) {
    return existing;
  }

  const shelf = $state<Shelf>({ list: [] });
  shelves.set(key, shelf);
  if (key) {
    void load(key, shelf);
  }

  return shelf;
}

export async function saveSkill(projectId: string, name: string, body: string): Promise<boolean> {
  const res = await fetch(endpoint(projectId), { method: 'POST', body: JSON.stringify({ name, body }) }).catch(() => null);
  if (!res?.ok) {
    return false;
  }

  await load(projectId, promptSkillsOf(projectId));
  return true;
}
