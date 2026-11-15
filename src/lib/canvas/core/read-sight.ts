export class OffScreenRead extends Error {
  constructor(id: string) {
    super(`custom component read of ${id} waits until it is on screen`);
  }
}

export type ReadSight = { hold: (id: string, onScreen: ReadonlySet<string>) => void; admits: (id: string, onScreen: ReadonlySet<string>) => boolean };

export function readSight(): ReadSight {
  const waiting = new Set<string>();

  const hold = (id: string, onScreen: ReadonlySet<string>) => {
    if (onScreen.has(id)) {
      return;
    }
    waiting.add(id);
    throw new OffScreenRead(id);
  };

  const admits = (id: string, onScreen: ReadonlySet<string>) => !waiting.has(id) || onScreen.has(id);

  return { hold, admits };
}
