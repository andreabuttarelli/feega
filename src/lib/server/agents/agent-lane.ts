import { AsyncLocalStorage } from 'node:async_hooks';

const lanes = new AsyncLocalStorage<string>();

export const inLane = <T>(lane: string, run: () => T): T => lanes.run(lane, run);

export const currentLane = (): string | null => lanes.getStore() ?? null;
