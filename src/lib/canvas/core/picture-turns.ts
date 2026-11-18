type Done = () => void;

export type Rank = () => number;

export type PictureTurns = { take: (rank: Rank) => Promise<Done>; owed: (vectorsOwed: boolean) => void };

type Waiting = { rank: Rank; start: (done: Done) => void };

export type PictureLimits = { whileOwed: number; open: number };

export function pictureTurns({ whileOwed, open }: PictureLimits): PictureTurns {
  const waiting: Waiting[] = [];
  let taken = 0;
  let held = false;

  const room = () => taken < (held ? whileOwed : open);

  const done = () => {
    taken--;
    next();
  };

  const nearest = () => waiting.reduce((best, w, i) => (w.rank() < waiting[best].rank() ? i : best), 0);

  function next() {
    while (waiting.length && room()) {
      taken++;
      waiting.splice(nearest(), 1)[0].start(done);
    }
  }

  return {
    take: (rank) =>
      new Promise<Done>((start) => {
        waiting.push({ rank, start });
        next();
      }),
    owed: (vectorsOwed) => {
      held = vectorsOwed;
      next();
    }
  };
}

export const owesVectors = (legible: readonly string[], onScreen: ReadonlySet<string>, built: (id: string) => boolean): boolean => legible.some((id) => onScreen.has(id) && !built(id));
