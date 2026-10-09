import { Device, deviceOf, type DeviceInfo } from '../render-place';
import { Engine } from '../engine';

export type Shooter<F> = (time: number, index: number) => Promise<F>;

const AHEAD_PER_LANE = 2;
const MAX_LANES = 4;
const CORES_PER_LANE = 2;
const UNKNOWN_CORES_LANES = 2;

const LANES_OF: Record<Device, (cores: number | null) => number> = {
  [Device.Desktop]: (cores) => (cores === null ? UNKNOWN_CORES_LANES : Math.max(1, Math.min(MAX_LANES, Math.floor(cores / CORES_PER_LANE)))),
  [Device.Mobile]: () => 2,
  [Device.WeakMobile]: () => 1
};

export function laneCount(info: DeviceInfo, engine: Engine): number {
  return engine === Engine.WebKit ? 1 : LANES_OF[deviceOf(info)](info.cores);
}

export async function shootInLanes<F>(times: number[], lanes: Shooter<F>[], onFrame: (frame: F, index: number) => Promise<void>, signal: AbortSignal): Promise<void> {
  const ready = new Map<number, F>();
  const window = lanes.length * AHEAD_PER_LANE;
  let emitted = 0;
  let failure: unknown = null;
  let wake: () => void = () => {};
  let moved = new Promise<void>((r) => (wake = r));

  const nudge = () => {
    wake();
    moved = new Promise<void>((r) => (wake = r));
  };
  const stopped = () => failure !== null || signal.aborted;

  async function flush() {
    while (ready.has(emitted) && !stopped()) {
      const frame = ready.get(emitted) as F;
      ready.delete(emitted);
      await onFrame(frame, emitted);
      emitted += 1;
      nudge();
    }
  }

  let flushing = Promise.resolve();
  const settle = () => (flushing = flushing.then(flush));

  async function run(shoot: Shooter<F>, lane: number) {
    for (let index = lane; index < times.length; index += lanes.length) {
      while (index >= emitted + window && !stopped()) {
        await moved;
      }
      if (stopped()) {
        return;
      }
      ready.set(index, await shoot(times[index], index));
      await settle();
    }
  }

  const fail = (e: unknown) => {
    failure ??= e;
    nudge();
  };
  signal.addEventListener('abort', nudge, { once: true });
  await Promise.all(lanes.map((shoot, lane) => run(shoot, lane).catch(fail)));
  await flushing.catch(fail);
  signal.throwIfAborted();
  if (failure !== null) {
    throw failure;
  }
}
