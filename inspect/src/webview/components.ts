import type { ComponentRow } from '../host/component-list';
import type { Focus } from './focus';

export type ComponentGroup = { folder: string; rows: ComponentRow[] };

const matches = (row: ComponentRow, needle: string) => row.name.toLowerCase().includes(needle) || row.folder.toLowerCase().includes(needle);

export function groupComponents(rows: ComponentRow[], query: string): ComponentGroup[] {
  const needle = query.trim().toLowerCase();
  const groups = new Map<string, ComponentRow[]>();

  for (const row of rows.filter((r) => matches(r, needle))) {
    groups.set(row.folder, [...(groups.get(row.folder) ?? []), row]);
  }

  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, inside]) => ({ folder, rows: inside.sort((a, b) => a.name.localeCompare(b.name)) }));
}

export const componentFocus = (row: ComponentRow): Focus => ({ name: row.name, source: { file: row.file, line: 1, col: 1 }, index: 0, usage: null, alone: true });

export const keyOfComponent = (row: ComponentRow) => `${row.file}::${row.name}`;

export const exampleLabel = (example: { file: string; line: number }) => `${example.file.split('/').slice(-2).join('/')}:${example.line}`;
