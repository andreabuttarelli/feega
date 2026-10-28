const DAY_MS = 24 * 60 * 60 * 1000;
export const REPORTS_PER_USER_PER_DAY = 5;
export const KEPT_IN_FULL_PER_DAY = 20;
export const SAMPLE_ONE_IN = 10;

export enum Verdict {
  Keep = 'keep',
  Drop = 'drop',
  OverLimit = 'over-limit'
}

export function createCrashGate(clock: () => number = Date.now) {
  let day = -1;
  let total = 0;
  let perUser = new Map<string, number>();

  return function admit(userId: string): Verdict {
    const today = Math.floor(clock() / DAY_MS);
    if (today !== day) {
      day = today;
      total = 0;
      perUser = new Map();
    }

    const mine = perUser.get(userId) ?? 0;
    if (mine >= REPORTS_PER_USER_PER_DAY) {
      return Verdict.OverLimit;
    }
    perUser.set(userId, mine + 1);
    total += 1;

    if (total <= KEPT_IN_FULL_PER_DAY || total % SAMPLE_ONE_IN === 0) {
      return Verdict.Keep;
    }
    return Verdict.Drop;
  };
}
