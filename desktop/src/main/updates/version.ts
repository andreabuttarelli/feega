type Parsed = { core: number[]; pre: string | null };

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/;

const parse = (raw: string): Parsed | null => {
  const match = SEMVER.exec(raw.trim());
  return match ? { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? null } : null;
};

const comparePre = (a: string | null, b: string | null): number => {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a < b ? -1 : 1;
};

export const isNewer = (current: string, candidate: string): boolean => {
  const have = parse(current);
  const next = parse(candidate);
  if (!have || !next) {
    return false;
  }
  for (let i = 0; i < have.core.length; i++) {
    if (next.core[i] !== have.core[i]) {
      return next.core[i] > have.core[i];
    }
  }
  return comparePre(have.pre, next.pre) < 0;
};
