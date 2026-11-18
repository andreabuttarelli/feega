type Done = () => void;

export type PictureTurns = { take: () => Promise<Done>; owed: (vectorsOwed: boolean) => void };

export function pictureTurns(whileOwed: number): PictureTurns {
  const waiting: ((done: Done) => void)[] = [];
  let taken = 0;
  let held = false;

  const room = () => !held || taken < whileOwed;

  const done = () => {
    taken--;
    next();
  };

  function next() {
    while (waiting.length && room()) {
      taken++;
      waiting.shift()!(done);
    }
  }

  return {
    take: () => new Promise<Done>((start) => {
      waiting.push(start);
      next();
    }),
    owed: (vectorsOwed) => {
      held = vectorsOwed;
      next();
    }
  };
}
