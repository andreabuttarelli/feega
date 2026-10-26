export enum LiveHost {
  Node = 'node',
  Canvas = 'canvas'
}

export const editableIds = (selected: string[], cap: number, coreOwned: ReadonlySet<string>): Set<string> => new Set(selected.filter((id) => !coreOwned.has(id)).slice(0, cap));

export const nextLive = (current: string | null, toggled: string): string | null => (current === toggled ? null : toggled);
