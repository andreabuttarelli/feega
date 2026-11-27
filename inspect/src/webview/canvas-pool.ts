export const POOL_CAP = 10;
export const MAX_LOADING = 2;
export const SETTLE_MS = 250;
export const PAINT_DELAY_MS = 150;
export const LOAD_TIMEOUT_MS = 15000;

type PoolAsk = { pool: string[]; wanted: string[]; settled: Set<string>; cap: number; maxLoading: number };

export type PoolPlan = { pool: string[]; evicted: string[] };

export function planPool({ pool, wanted, settled, cap, maxLoading }: PoolAsk): PoolPlan {
  const loading = pool.filter((key) => !settled.has(key)).length;
  const fresh = wanted.filter((key) => !pool.includes(key)).slice(0, Math.max(0, maxLoading - loading));
  const next = [...pool.filter((key) => !wanted.includes(key)), ...pool.filter((key) => wanted.includes(key)), ...fresh];
  const evicted: string[] = [];

  while (next.length - evicted.length > cap) {
    const victim = next.find((key) => !wanted.includes(key) && !evicted.includes(key));
    if (!victim) {
      break;
    }
    evicted.push(victim);
  }

  return { pool: next.filter((key) => !evicted.includes(key)), evicted };
}

export function settler(fire: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return () => {
    clearTimeout(timer);
    timer = setTimeout(fire, ms);
  };
}
