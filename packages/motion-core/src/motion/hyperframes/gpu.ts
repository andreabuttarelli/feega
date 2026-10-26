import { js } from './html';

export const GPU_GLOBAL = '__feegaGpu';

export enum Scaling {
  Adaptive = 'adaptive',
  Fixed = 'fixed'
}

enum Resolution {
  Output = 'output',
  Display = 'display'
}

enum Antialias {
  Always = 'always',
  FinePointer = 'fine-pointer'
}

export type GpuProfile = { resolution: Resolution; antialias: Antialias; power: WebGLPowerPreference | null };

export const VIDEO_GPU: GpuProfile = { resolution: Resolution.Output, antialias: Antialias.Always, power: null };
export const SCREEN_GPU: GpuProfile = { resolution: Resolution.Display, antialias: Antialias.FinePointer, power: 'high-performance' };

export const GPU_PACE = { fineDpr: 1.5, coarseDpr: 1.25, budgetMs: 19, headroomMs: 12, slowFrames: 20, fastFrames: 120, step: 0.8, floor: 0.4, staleMs: 250 };

type PaceRules = typeof GPU_PACE;
type Display = { dpr: number; coarse: boolean; long: number };
type Pace = { scale: number; slow: number; fast: number };

export function startScale(d: Display, outputLong: number, rules: PaceRules): number {
  const dpr = Math.min(d.dpr, d.coarse ? rules.coarseDpr : rules.fineDpr);
  return Math.min(1, Math.round(((d.long * dpr) / outputLong) * 100) / 100);
}

export function paced(p: Pace, frameMs: number, top: number, rules: PaceRules): Pace {
  if (frameMs > rules.budgetMs) {
    const slow = p.slow + 1;
    return slow < rules.slowFrames ? { ...p, slow, fast: 0 } : { scale: Math.max(rules.floor, Math.round(p.scale * rules.step * 100) / 100), slow: 0, fast: 0 };
  }
  if (frameMs >= rules.headroomMs) {
    return { ...p, slow: 0, fast: 0 };
  }
  const fast = p.fast + 1;
  return fast < rules.fastFrames ? { ...p, slow: 0, fast } : { scale: Math.min(top, Math.round((p.scale / rules.step) * 100) / 100), slow: 0, fast: 0 };
}

type GpuConfig = { rules: PaceRules; name: string; scaling: typeof Scaling; resolution: typeof Resolution; antialias: typeof Antialias };

function gpuMain(cfg: GpuConfig, scaleAt: typeof startScale, paceAt: typeof paced, profile: GpuProfile, win: Window & Record<string, unknown>, doc: Document) {
  const { rules, scaling: Scaling, resolution: Resolution, antialias: Antialias } = cfg;
  const screenOnly = profile.resolution === Resolution.Display;
  const coarse = !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);
  const kept: { renderer: { setPixelRatio: (r: number) => void } }[] = [];
  let top = 1;
  let pace = { scale: 1, slow: 0, fast: 0 };
  let rendered = false;
  let last = -1;

  const measure = () => {
    if (!screenOnly) {
      return 1;
    }
    const root = doc.getElementById('root');
    const out = Math.max(Number(root?.dataset.width) || 1, Number(root?.dataset.height) || 1);
    const long = Math.max(win.screen?.width || 0, win.screen?.height || 0) || out;
    return scaleAt({ dpr: win.devicePixelRatio || 1, coarse, long }, out, rules);
  };

  const tick = (now: number) => {
    if (rendered && last >= 0 && now - last < rules.staleMs) {
      const next = paceAt(pace, now - last, top, rules);
      if (next.scale !== pace.scale) {
        kept.forEach((k) => k.renderer.setPixelRatio(next.scale));
      }
      pace = next;
    }
    last = rendered ? now : -1;
    rendered = false;
    win.requestAnimationFrame(tick);
  };

  const renderer = (THREE: { WebGLRenderer: new (o: object) => never }, canvas: object, extra: object = {}, scaling: Scaling = Scaling.Adaptive) => {
    if (!kept.length && screenOnly) {
      top = measure();
      pace = { scale: top, slow: 0, fast: 0 };
      win.requestAnimationFrame(tick);
    }
    const antialias = profile.antialias === Antialias.Always || !coarse;
    const options = { canvas, alpha: true, antialias, preserveDrawingBuffer: true, ...(profile.power ? { powerPreference: profile.power } : {}), ...extra };
    const made = new THREE.WebGLRenderer(options) as { setPixelRatio: (r: number) => void; render: (...a: unknown[]) => void };
    made.setPixelRatio(scaling === Scaling.Fixed ? 1 : pace.scale);
    if (scaling === Scaling.Fixed || !screenOnly) {
      return made;
    }
    const render = made.render.bind(made);
    made.render = (...a: unknown[]) => {
      rendered = true;
      render(...a);
    };
    kept.push({ renderer: made });
    return made;
  };

  win[cfg.name] = { renderer, scale: () => pace.scale };
}

export function gpuScript(profile: GpuProfile): string {
  const cfg: GpuConfig = { rules: GPU_PACE, name: GPU_GLOBAL, scaling: Scaling, resolution: Resolution, antialias: Antialias };
  return `(${gpuMain.toString()})(${js(cfg)},(${startScale.toString()}),(${paced.toString()}),${js(profile)},window,document);`;
}
