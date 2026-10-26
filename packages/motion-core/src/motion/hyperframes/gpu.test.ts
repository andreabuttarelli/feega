import { describe, expect, it } from 'vitest';
import { GPU_GLOBAL, Scaling, SCREEN_GPU, VIDEO_GPU, gpuScript, paced, startScale, type GpuProfile } from './gpu';

type Made = { options: Record<string, unknown>; ratio: number; renders: number };

class FakeRenderer {
  static made: Made[] = [];
  made: Made;
  constructor(options: Record<string, unknown>) {
    this.made = { options, ratio: 1, renders: 0 };
    FakeRenderer.made.push(this.made);
  }
  setPixelRatio(r: number) {
    this.made.ratio = r;
  }
  render() {
    this.made.renders++;
  }
}

type Gpu = { renderer: (three: unknown, canvas: object, extra?: object, scaling?: Scaling) => FakeRenderer; scale: () => number };

function boot(profile: GpuProfile, device: { dpr: number; coarse: boolean; screen: [number, number] }, comp: [number, number] = [1080, 1920]) {
  FakeRenderer.made = [];
  const frames: ((t: number) => void)[] = [];
  const win: Record<string, unknown> = {
    devicePixelRatio: device.dpr,
    screen: { width: device.screen[0], height: device.screen[1] },
    matchMedia: (q: string) => ({ matches: q.includes('coarse') ? device.coarse : false }),
    requestAnimationFrame: (fn: (t: number) => void) => frames.push(fn)
  };
  const doc = { getElementById: () => ({ dataset: { width: String(comp[0]), height: String(comp[1]) } }) };
  new Function('window', 'document', gpuScript(profile))(win, doc);
  const gpu = win[GPU_GLOBAL] as Gpu;
  const make = (scaling = Scaling.Adaptive) => gpu.renderer({ WebGLRenderer: FakeRenderer }, { width: comp[0], height: comp[1] }, {}, scaling);
  const tick = (now: number) => frames.splice(0).forEach((fn) => fn(now));
  return { gpu, make, tick };
}

const PHONE = { dpr: 3, coarse: true, screen: [390, 844] as [number, number] };
const LAPTOP = { dpr: 2, coarse: false, screen: [1512, 982] as [number, number] };

describe('il video esce identico a prima', () => {
  it('pixel ratio 1, antialias acceso, nessuna preferenza di potenza', () => {
    const { make } = boot(VIDEO_GPU, PHONE);
    make();
    expect(FakeRenderer.made[0].ratio).toBe(1);
    expect(FakeRenderer.made[0].options).toEqual({ canvas: expect.any(Object), alpha: true, antialias: true, preserveDrawingBuffer: true });
  });

  it('il frame lento non abbassa la risoluzione del video', () => {
    const { make, tick } = boot(VIDEO_GPU, PHONE);
    const r = make();
    for (let i = 0; i < 200; i++) {
      r.render();
      tick(i * 100);
    }
    expect(FakeRenderer.made[0].ratio).toBe(1);
  });
});

describe('sullo schermo il renderer è tarato sul dispositivo', () => {
  it('telefono: risoluzione limitata a DPR 1.25 dello schermo e antialias spento', () => {
    const { make } = boot(SCREEN_GPU, PHONE);
    make();
    expect(FakeRenderer.made[0].ratio).toBeCloseTo((844 * 1.25) / 1920, 2);
    expect(FakeRenderer.made[0].options).toMatchObject({ antialias: false, powerPreference: 'high-performance' });
  });

  it('laptop: risoluzione piena, antialias acceso', () => {
    const { make } = boot(SCREEN_GPU, LAPTOP);
    make();
    expect(FakeRenderer.made[0].ratio).toBe(1);
    expect(FakeRenderer.made[0].options).toMatchObject({ antialias: true });
  });

  it('un renderer Fixed resta a risoluzione piena', () => {
    const { make } = boot(SCREEN_GPU, PHONE);
    make(Scaling.Fixed);
    expect(FakeRenderer.made[0].ratio).toBe(1);
  });

  it('frame lenti abbassano la risoluzione, il margine la riporta su', () => {
    const { make, tick } = boot(SCREEN_GPU, LAPTOP);
    const r = make();
    let now = 0;
    const run = (frames: number, ms: number) => {
      for (let i = 0; i < frames; i++) {
        r.render();
        now += ms;
        tick(now);
      }
    };
    run(60, 40);
    const dropped = FakeRenderer.made[0].ratio;
    expect(dropped).toBeLessThan(1);
    run(600, 8);
    expect(FakeRenderer.made[0].ratio).toBe(1);
  });

  it('a riposo, senza render, la risoluzione non cambia', () => {
    const { make, tick } = boot(SCREEN_GPU, LAPTOP);
    make();
    for (let i = 0; i < 200; i++) {
      tick(i * 40);
    }
    expect(FakeRenderer.made[0].ratio).toBe(1);
  });
});

describe('startScale', () => {
  it('non supera mai la risoluzione di uscita', () => {
    expect(startScale({ dpr: 3, coarse: false, long: 3000 }, 1920)).toBe(1);
  });
});

describe('paced', () => {
  it('scende per gradini e non sotto il pavimento', () => {
    let p = { scale: 1, slow: 0, fast: 0 };
    for (let i = 0; i < 10_000; i++) {
      p = paced(p, 100, 1);
    }
    expect(p.scale).toBeGreaterThanOrEqual(0.4);
    expect(p.scale).toBeLessThan(0.5);
  });

  it('non sale oltre il tetto di sessione', () => {
    let p = { scale: 0.5, slow: 0, fast: 0 };
    for (let i = 0; i < 10_000; i++) {
      p = paced(p, 5, 0.6);
    }
    expect(p.scale).toBe(0.6);
  });
});
