export enum LiveHost {
  Node = 'node',
  Canvas = 'canvas'
}

export const editableIds = (selected: string[], cap: number): Set<string> => new Set(selected.slice(0, cap));

export const nextLive = (current: string | null, toggled: string): string | null => (current === toggled ? null : toggled);
