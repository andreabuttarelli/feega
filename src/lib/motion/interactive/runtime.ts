import type { InputValues } from '../expression/inputs';
import { OUT } from '../hyperframes/channel-out';
import { ENGINE_GLOBAL } from '../engine/engine';
import { laneName, liveScene, type LiveSpec } from './live';

export const INPUT_MESSAGE = 'feega:input';
export const LIVE_GLOBAL = '__feegaLive';
export const COMPOSITION_TIMELINE = 'main';

export type InputMessage = { type: typeof INPUT_MESSAGE; values: InputValues };

type Timeline = { time: () => number; to: (target: object, vars: Record<string, unknown>, at: number) => unknown };
type Engine = { set: (target: string, vars: Record<string, unknown>) => void };
type LiveWindow = Window & { __timelines?: Record<string, Timeline> } & Record<string, unknown>;

const MS_PER_SECOND = 1000;
const MAX_STEP_SECONDS = 0.1;

export function installLive(spec: LiveSpec): void {
  const win = window as unknown as LiveWindow;
  const scene = liveScene(spec);
  const size = { width: spec.width, height: spec.height };
  const engine = () => win[ENGINE_GLOBAL] as Engine | undefined;
  const timeline = () => win.__timelines?.[COMPOSITION_TIMELINE];
  let inputs: InputValues = {};
  let latest = new Map<string, number>();
  let last = performance.now();

  const paint = () => {
    const set = engine()?.set;
    if (!set) {
      return;
    }
    for (const lane of scene.lanes) {
      const value = latest.get(laneName(lane));
      if (value === undefined) {
        continue;
      }
      set(lane.target, { [lane.prop]: OUT[lane.out](value, size) });
    }
  };

  const step = (now: number) => {
    const dt = Math.min(MAX_STEP_SECONDS, (now - last) / MS_PER_SECOND);
    last = now;
    const frame = Math.round((timeline()?.time() ?? 0) * spec.fps);
    latest = scene.tick(inputs, frame, dt);
    paint();
    requestAnimationFrame(step);
  };

  addEventListener('message', (e: MessageEvent) => {
    const m = e.data as InputMessage;
    if (m?.type !== INPUT_MESSAGE) {
      return;
    }
    inputs = m.values;
  });

  timeline()?.to({}, { duration: spec.duration, ease: 'none', onUpdate: paint }, 0);
  requestAnimationFrame(step);
}
