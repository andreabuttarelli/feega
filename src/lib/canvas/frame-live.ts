export enum LiveHost {
  Node = 'node',
  Canvas = 'canvas'
}

export enum CoreMode {
  On = 'on',
  Off = 'off'
}

export const editableIds = (selected: string[], tiles: { id: string; kind?: string }[], core: CoreMode, cap: number): Set<string> => {
  const frames = new Set(tiles.filter((t) => t.kind === 'motion').map((t) => t.id));
  const ids = core === CoreMode.On ? selected.filter((id) => !frames.has(id)) : selected;
  return new Set(ids.slice(0, cap));
};

export const nextLive = (current: string | null, toggled: string): string | null => (current === toggled ? null : toggled);
