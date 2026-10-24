export type TechniqueItem = { id: string; name: string; nodes: number };

type Shelf = { list: TechniqueItem[] };

const shelves = new Map<string, Shelf>();

export async function reloadTechniques(projectId: string, shelf: Shelf) {
  const res = await fetch(`/api/v1/projects/${projectId}/agent/techniques`).catch(() => null);
  if (!res?.ok) {
    return;
  }

  const body = (await res.json()) as { techniques?: TechniqueItem[] };
  shelf.list = body.techniques ?? [];
}

export function techniquesOf(projectId: string | undefined): Shelf {
  const key = projectId ?? '';
  const existing = shelves.get(key);
  if (existing) {
    return existing;
  }

  const shelf = $state<Shelf>({ list: [] });
  shelves.set(key, shelf);
  if (key) {
    void reloadTechniques(key, shelf);
  }

  return shelf;
}
