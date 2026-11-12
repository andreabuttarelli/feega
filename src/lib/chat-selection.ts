export enum ChipKind {
  Node = 'node',
  Layer = 'layer'
}

export type SelectionChip = { id: string; kind: ChipKind; type: string; name: string; frameId?: string };

type Source = { id: string; type: string; name: string };

export const MAX_CHIPS = 20;
export const SHOWN_CHIPS = 3;
const MAX_NAME = 120;

const KINDS = new Set<string>(Object.values(ChipKind));

export function canvasChips(ids: readonly string[], rows: readonly Source[]): SelectionChip[] {
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids.flatMap((id) => {
    const row = byId.get(id);

    return row ? [{ id, kind: ChipKind.Node, type: row.type, name: row.name }] : [];
  });
}

export function layerChips(frameId: string, layers: readonly Source[]): SelectionChip[] {
  return layers.map(({ id, type, name }) => ({ id, kind: ChipKind.Layer, type, name, frameId }));
}

export function liveChips(canvas: SelectionChip[], layers: SelectionChip[]): SelectionChip[] {
  return layers.length ? layers : canvas;
}

export function visibleChips(chips: SelectionChip[], cap = SHOWN_CHIPS): { shown: SelectionChip[]; more: number } {
  return { shown: chips.slice(0, cap), more: Math.max(0, chips.length - cap) };
}

export function withoutDismissed(chips: SelectionChip[], dismissed: ReadonlySet<string>): SelectionChip[] {
  return chips.filter((chip) => !dismissed.has(chip.id));
}

function readChip(raw: unknown): SelectionChip | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const { id, kind, type, name, frameId } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || typeof type !== 'string' || typeof name !== 'string' || typeof kind !== 'string' || !KINDS.has(kind)) {
    return null;
  }

  return { id, kind: kind as ChipKind, type, name: name.slice(0, MAX_NAME), ...(typeof frameId === 'string' ? { frameId } : {}) };
}

export function readChips(raw: unknown): SelectionChip[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => readChip(item) ?? []).slice(0, MAX_CHIPS);
}

function describe(chip: SelectionChip): string {
  const where = chip.frameId ? `, in frame ${chip.frameId}` : '';

  return `${chip.kind} "${chip.name}" (${chip.type}, id ${chip.id}${where})`;
}

export function selectionNote(chips: SelectionChip[]): string {
  if (!chips.length) {
    return '';
  }

  return `The user has these selected: ${chips.map(describe).join(', ')}. "This", "it" and "the selection" mean them: act on them unless the user names something else.`;
}
