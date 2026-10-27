import type { Db } from '$lib/server/db/client';

export const LOCAL_TICK_MS = 15_000;

type Tick = (db: Db) => Promise<unknown>;

async function reconcileRuns(db: Db): Promise<void> {
  const { reconcileAudioNodeRuns, reconcileTaskNodeRuns, reconcileVideoNodeRuns } = await import('$lib/server/canvas/generate');
  await reconcileTaskNodeRuns(db);
  await reconcileVideoNodeRuns(db);
  await reconcileAudioNodeRuns(db);
}

export function startLocalTicker(db: Db, tick: Tick = reconcileRuns): () => void {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) {
      return;
    }
    busy = true;
    await tick(db).catch((e) => console.error('[feega local] run reconcile failed', e));
    busy = false;
  }, LOCAL_TICK_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
