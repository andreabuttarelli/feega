import type { InputValues } from '../expression/inputs';
import { OUT } from '../hyperframes/channel-out';
import { ENGINE_GLOBAL } from '../engine/engine';
import { laneName, liveScene, type LiveSpec, type StyleLane } from './live';
import { lensPainter } from './lens-paint';
import { LivePaint } from './paint';
import { BindPaint, type PaintBinding, type VarValues } from './var-model';

export const INPUT_MESSAGE = 'feega:input';
export const LIVE_GLOBAL = '__feegaLive';
export const COMPOSITION_TIMELINE = 'main';

export type InputMessage = { type: typeof INPUT_MESSAGE; values: InputValues; vars?: VarValues };

const BIND_PAINT: Record<BindPaint, (el: HTMLElement, value: string) => void> = {
  [BindPaint.Text]: (el, value) => {
    el.textContent = value;
  },
  [BindPaint.Color]: (el, value) => {
    el.style.color = value;
  },
  [BindPaint.Background]: (el, value) => {
    el.style.background = value;
  }
};

export function paintVars(root: ParentNode, bindings: readonly PaintBinding[], vars: VarValues): void {
  for (const binding of bindings) {
    const value = vars[binding.var];
    if (typeof value !== 'string') {
      continue;
    }
    root.querySelectorAll<HTMLElement>(binding.selector).forEach((el) => BIND_PAINT[binding.paint](el, value));
  }
}

type Timeline = { time: () => number; to: (target: object, vars: Record<string, unknown>, at: number) => unknown };
type Engine = { set: (target: string, vars: Record<string, unknown>) => void };
type LiveWindow = Window & { __timelines?: Record<string, Timeline> } & Record<string, unknown>;

const MS_PER_SECOND = 1000;
const MAX_STEP_SECONDS = 0.1;

export function installLive(spec: LiveSpec): void {
  const win = window as unknown as LiveWindow;
  const scene = liveScene(spec);
  const size = { width: spec.width, height: spec.height };
  const styles = scene.lanes.filter((lane): lane is StyleLane => lane.paint === LivePaint.Style);
  const lenses = lensPainter(spec.lenses, { ...size, fps: spec.fps }, win);
  const engine = () => win[ENGINE_GLOBAL] as Engine | undefined;
  const timeline = () => win.__timelines?.[COMPOSITION_TIMELINE];
  let inputs: InputValues = {};
  let vars: VarValues | undefined;
  let painted = '';
  let latest = new Map<string, number>();
  let last = performance.now();

  const paint = () => {
    lenses.paint();
    const set = engine()?.set;
    if (!set) {
      return;
    }
    for (const lane of styles) {
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
    latest = scene.tick(inputs, frame, dt, vars);
    lenses.tick(latest, frame, dt);
    paint();
    requestAnimationFrame(step);
  };

  addEventListener('message', (e: MessageEvent) => {
    const m = e.data as InputMessage;
    if (m?.type !== INPUT_MESSAGE) {
      return;
    }
    inputs = m.values;
    const key = m.vars ? JSON.stringify(m.vars) : painted;
    if (m.vars && key !== painted) {
      vars = m.vars;
      painted = key;
      paintVars(document, spec.bindings, vars);
    }
  });

  timeline()?.to({}, { duration: spec.duration, ease: 'none', onUpdate: paint }, 0);
  requestAnimationFrame(step);
}
