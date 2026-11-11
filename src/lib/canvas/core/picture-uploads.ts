const MAX_ROUNDS = 64;

export function uploadWithin(groups: readonly string[], upload: (group: string) => boolean, now: () => number, budgetMs: number): string[] {
  const deadline = now() + budgetMs;
  const done: string[] = [];
  let waiting = [...groups];

  for (let round = 0; round < MAX_ROUNDS && waiting.length; round++) {
    for (const group of waiting) {
      if (upload(group)) {
        done.push(group);
      }
      if (round > 0 && now() >= deadline) {
        return done;
      }
    }
    waiting = waiting.filter((g) => !done.includes(g));
    if (now() >= deadline) {
      return done;
    }
  }
  return done;
}
