import { clipsOf, type MotionDoc } from '../doc';
import type { AudioAnalysis } from '../audio-analysis';
import type { InputValues } from '../expression/inputs';
import { liveWrite } from '../hyperframes/animate';
import { ENGINE_GLOBAL } from '../engine/engine';
import { laneName, liveScene } from './live';
import type { Outside } from './settings';

export const INPUT_MESSAGE = 'feega:input';
export const LIVE_GLOBAL = '__feegaLive';
export const COMPOSITION_TIMELINE = 'main';

export type InputMessage = { type: typeof INPUT_MESSAGE; values: InputValues };

export type LiveConfig = { doc: MotionDoc; analyses: Record<string, AudioAnalysis>; outside: Outside; parents: string[] };

type Timeline = { time: () => number; to: (target: object, vars: Record<string, unknown>, at: number) => unknown };
type Engine = { set: (target: string, vars: Record<string, unknown>) => void };
type LiveWindow = Window & { __timelines?: Record<string, Timeline> } & Record<string, unknown>;

const MS_PER_SECOND = 1000;
const MAX_STEP_SECONDS = 0.1;

export function installLive(config: LiveConfig): void {
  const win = window as unknown as LiveWindow;
  const { doc } = config;
  const scene = liveScene(doc, config.analyses, config.outside);
  const byId = new Map(clipsOf(doc).map((c) => [c.id, c]));
  const parents = new Set(config.parents);
  const frameSize = { width: doc.width, height: doc.height, fps: doc.fps };
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
      const clip = byId.get(lane.id);
      if (value === undefined || !clip) {
        continue;
      }
      const write = liveWrite(clip, lane.key, value, frameSize, parents);
      set(write.target, write.vars);
    }
  };

  const step = (now: number) => {
    const dt = Math.min(MAX_STEP_SECONDS, (now - last) / MS_PER_SECOND);
    last = now;
    const frame = Math.round((timeline()?.time() ?? 0) * doc.fps);
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

  timeline()?.to({}, { duration: doc.durationInFrames / doc.fps, ease: 'none', onUpdate: paint }, 0);
  requestAnimationFrame(step);
}
