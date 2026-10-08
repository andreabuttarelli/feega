import type { CustomEffect } from './custom';

type Shelf = { list: CustomEffect[] };

const shelves = new Map<string, Shelf>();

async function load(projectId: string, shelf: Shelf) {
  const res = await fetch(`/api/v1/projects/${projectId}/agent/custom-effects`).catch(() => null);
  if (!res?.ok) {
    return;
  }

  const body = (await res.json()) as { effects?: CustomEffect[] };
  shelf.list = body.effects ?? [];
}

export function customEffectsOf(projectId: string | undefined): Shelf {
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
