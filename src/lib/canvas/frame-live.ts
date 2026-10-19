export enum LiveHost {
  Node = 'node',
  Canvas = 'canvas'
}

export const nextLive = (current: string | null, toggled: string): string | null => (current === toggled ? null : toggled);
