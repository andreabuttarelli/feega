import { writable } from 'svelte/store';

export type PropertiesTarget = { id: string; name: string };

type Row = { id: string; type: string; displayName: string | null };

const UNNAMED = 'Frame';

export const propertiesTarget = writable<PropertiesTarget | null>(null);

export const propertiesRequest = writable<string | null>(null);

export function targetOf(selected: readonly string[], rows: readonly Row[]): PropertiesTarget | null {
  const row = selected.length === 1 ? rows.find((r) => r.id === selected[0]) : null;
  if (row?.type !== 'motion') {
    return null;
  }
  return { id: row.id, name: row.displayName ?? UNNAMED };
}

export const editingLabel = (name: string): string => `Editing: ${name}`;
