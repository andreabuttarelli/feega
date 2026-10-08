import { InputKey } from '../expression/inputs';
import { INPUT_MESSAGE } from '../interactive/runtime';
import { contentStamp } from '../stamp';
import { js } from '../hyperframes/html';
import type { CustomComponents } from './component';
import { ENGINE_GLOBAL } from '../engine/engine';
import { fixedFormat } from './format';
import { GENERATIVE_GLOBAL } from './generative';
import { TWGL_GLOBAL } from './twgl';
import { FX_GLOBAL } from './fx';
import { SPLITTING_GLOBAL } from './splitting';
import { OPEN_PROPS_GLOBAL } from './open-props';

export const REGISTRY = '__feegaComponents';
export const ERRORS = '__feegaErrors';
const ERROR_LISTENER = '__feegaErrorListener';
export const THREE_GLOBAL = '__feegaThree';
export const LIVE_RUNS = '__feegaLiveRuns';
export const EVENT_MESSAGE = 'feega:event';
export const LITTLEJS_GLOBAL = '__feegaLittleJS';

export enum Play {
  Seeked = 'seeked',
  Live = 'live',
  Still = 'still'
}

const CLOCK_SHADOWS = ['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'requestIdleCallback', 'queueMicrotask', 'performance', 'Math', 'Date'];

export const SHADOWED = [
  'window',
  'self',
  'globalThis',
  'parent',
  'top',
  'opener',
  'frames',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'Worker',
  'SharedWorker',
  'importScripts',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'requestIdleCallback',
  'queueMicrotask',
  'performance',
  'navigator',
  'location',
  'postMessage',
  'Function',
  'Math',
  'Date'
] as const;

export enum Library {
  Lottie = 'lottie',
  LittleJS = 'LittleJS',
  Kaplay = 'kaplay',
  Three = 'THREE',
  D3 = 'd3',
  P5 = 'p5',
  Pixi = 'PIXI',
  Matter = 'Matter',
  Generative = 'gen',
  Twgl = 'twgl',
  Fx = 'fx',
  Splitting = 'Splitting',
  OpenProps = 'OpenProps'
}

const USES: Record<Library, RegExp> = {
  [Library.Lottie]: /\blottie\b/,
  [Library.LittleJS]: /\bLittleJS\b/,
  [Library.Kaplay]: /\bkaplay\b/,
  [Library.Three]: /\bTHREE\b/,
  [Library.D3]: /\bd3\b/,
  [Library.P5]: /\bp5\b/,
  [Library.Pixi]: /\bPIXI\b/,
  [Library.Matter]: /\bMatter\b/,
  [Library.Generative]: /\bgen\./,
  [Library.Twgl]: /\btwgl\b/,
  [Library.Fx]: /\bfx\./,
  [Library.Splitting]: /\bSplitting\b/,
  [Library.OpenProps]: /\bOpenProps\b|['"]ease-[a-z0-9-]+['"]/
};

const STYLE_USES: Partial<Record<Library, RegExp>> = {
  [Library.OpenProps]: /var\(--(size|shadow|gradient|ease)-/
};

const GLOBALS: Record<Library, string> = {
  [Library.Lottie]: 'lottie',
  [Library.LittleJS]: LITTLEJS_GLOBAL,
  [Library.Kaplay]: 'kaplay',
  [Library.Three]: THREE_GLOBAL,
  [Library.D3]: 'd3',
  [Library.P5]: 'p5',
  [Library.Pixi]: 'PIXI',
  [Library.Matter]: 'Matter',
  [Library.Generative]: GENERATIVE_GLOBAL,
  [Library.Twgl]: TWGL_GLOBAL,
  [Library.Fx]: FX_GLOBAL,
  [Library.Splitting]: SPLITTING_GLOBAL,
  [Library.OpenProps]: OPEN_PROPS_GLOBAL
};

export function librariesOf(components: CustomComponents, used: Iterable<string>): Set<Library> {
  const code = [...used].map((name) => components[name]?.source.js ?? '').join('\n');
  const styles = [...used].map((name) => components[name]?.source.css ?? '').join('\n');
  return new Set((Object.keys(USES) as Library[]).filter((lib) => USES[lib].test(code) || STYLE_USES[lib]?.test(styles)));
}

export type ParamKey = { at: number; value: number | string; ease: string };
export type CustomRun = { id: string; name: string; start: number; length: number; fps: number; values: Record<string, unknown>; seed: number; keys?: Record<string, ParamKey[]>; trim?: number; play?: Play };

export type CustomEnv = { assets: Record<string, string>; brand: { name: string; colors: Record<string, string>; logoUrl: string | null } };

export function seedOf(clipId: string): number {
  return parseInt(contentStamp(clipId).split('-')[0], 36) >>> 0;
}

export function definitionScript(name: string, code: string): string {
  const body = code.replace(/<\/(script)/gi, '<\\/$1');
  return `<script>(window.${REGISTRY}=window.${REGISTRY}||{})[${js(name)}]=function(ctx,${SHADOWED.join(',')}){"use strict";const {root,props,tl,duration,fps,assets,brand,rand,param,format,motion,gsap,SplitText,input,onPause,onResume,onDestroy,${Object.values(Library).join(',')}}=ctx;{\n${body}\n}};</script>`;
}

type Engine = { timeline: () => Timeline; parseEase: (ease: string) => (p: number) => number; registerEase: (name: string, ease: (p: number) => number) => void; utils: { interpolate: (a: unknown, b: unknown, p: number) => unknown }; split: unknown; SplitText: unknown };
type BootWindow = Window & Record<string, unknown>;
type Timeline = { time: () => number; to: (t: object, v: object, at: number) => void; set: (t: object, v: object, at: number) => void; add: (child: object, at: number) => void; fromTo: (t: object, a: object, b: object, at: number) => void; tweenFromTo: (from: number, to: number, vars: object) => object };
type ClipError = { clip: string; component: string; message: string };
type Sketch = { setup?: () => void; frameCount: number; noLoop: () => void; randomSeed: (seed: number) => void; noiseSeed: (seed: number) => void; redraw: () => void };
type SketchClass = new (sketch: (p: Sketch) => void, node: HTMLElement) => Sketch;
type Stage = { Application: new (options: object) => object };
type Body = { position: { x: number; y: number }; angle: number };
type Pose = { x: number; y: number; angle: number };
type World = { world: object };
type Physics = { Engine: { update: (engine: World, delta: number) => void }; Composite: { allBodies: (world: object) => Body[] }; Common: { _seed: number } };
type Random = () => number;
type Generative = { createNoise2D: (r: Random) => unknown; createNoise3D: (r: Random) => unknown; createNoise4D: (r: Random) => unknown; PoissonDiskSampling: new (options: object, r: Random) => unknown };
type Split = { target?: string | object; by?: string };
type ClipScope = { root: HTMLElement; tl: Timeline; run: CustomRun; hooks: Hooks };
type Little = { vec2: (x: number, y: number) => object; setCanvasFixedSize: (size: object) => void; setEngineManualStep: (on: boolean) => void; engineStep: (frames: number) => void; engineObjectsDestroy: () => void; engineInit: (...args: unknown[]) => Promise<unknown> };
type Game = { debug: { paused: boolean }; quit: () => void; randSeed: (seed: number) => void; onDraw: (draw: () => void) => void };
type Input = { x: number; y: number; down: boolean; hover: boolean; tiltX: number; tiltY: number; keys: Set<string> };
type Hooks = { pause: (() => void)[]; resume: (() => void)[]; destroy: (() => void)[] };
type Forwarded = { type?: string; kind?: string; x?: number; y?: number; key?: string; code?: string; values?: Record<string, number> };
type BootConfig = { registry: string; errors: string; listener: string; libraries: Record<string, string>; engine: string; shadowed: string[]; clock: string[]; liveRuns: string; eventMessage: string; inputMessage: string; tilt: { x: string; y: string } };

function bootCustom(cfg: BootConfig, runs: CustomRun[], env: CustomEnv, master: Timeline, format: ReturnType<typeof fixedFormat>) {
  const w = window as unknown as BootWindow;
  const engine = w[cfg.engine] as Engine;
  const errors: ClipError[] = [];
  w[cfg.errors] = errors;
  const registry = (w[cfg.registry] ?? {}) as Record<string, (ctx: object, ...shadows: unknown[]) => unknown>;
  const refuse = (what: string, instead: string) => () => {
    throw new Error(`${what} is not allowed in a component: ${instead}`);
  };
  const safeMath = Object.create(Math, { random: { value: refuse('Math.random', 'use rand()') } });
  const safeDate = new Proxy(Date, {
    construct: (target, args) => {
      if (!args.length) {
        refuse('new Date()', 'time comes from tl')();
      }
      return new target(...(args as [number]));
    },
    apply: refuse('Date()', 'time comes from tl'),
    get: (target, key) => (key === 'now' ? refuse('Date.now', 'time comes from tl') : Reflect.get(target, key))
  });
  const seekedShadows = cfg.shadowed.map((name) => (name === 'Math' ? safeMath : name === 'Date' ? safeDate : undefined));
  const seeded = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };


  for (const destroy of (w[cfg.liveRuns] as (() => void)[] | undefined) ?? []) {
    destroy();
  }
  const liveRuns: (() => void)[] = [];
  w[cfg.liveRuns] = liveRuns;

  const input: Input = { x: 0, y: 0, down: false, hover: false, tiltX: 0, tiltY: 0, keys: new Set() };
  const POINTER_TO_MOUSE: Record<string, string> = { pointerdown: 'mousedown', pointerup: 'mouseup', pointermove: 'mousemove' };
  const forward = (m: Forwarded, area: HTMLElement) => {
    if (m.key !== undefined) {
      document.dispatchEvent(new KeyboardEvent(m.kind ?? 'keydown', { key: m.key, code: m.code, bubbles: true }));
      return;
    }
    const box = area.getBoundingClientRect();
    const at = { clientX: box.left + (m.x ?? 0) * box.width, clientY: box.top + (m.y ?? 0) * box.height, bubbles: true, button: 0, buttons: m.kind === 'pointerup' ? 0 : 1 };
    const target = document.elementFromPoint?.(at.clientX, at.clientY) ?? document;
    const kind = m.kind ?? 'pointermove';
    target.dispatchEvent(typeof PointerEvent === 'function' ? new PointerEvent(kind, { ...at, pointerId: 1, isPrimary: true }) : new MouseEvent(kind, at));
    target.dispatchEvent(new MouseEvent(POINTER_TO_MOUSE[kind] ?? kind, at));
    if (kind === 'pointerdown') {
      (target as HTMLElement).focus?.({ preventScroll: true });
    }
  };
  const listenInput = (area: HTMLElement) => {
    const point = (e: MouseEvent) => {
      const box = area.getBoundingClientRect();
      input.x = e.clientX - box.left;
      input.y = e.clientY - box.top;
      input.hover = true;
    };
    const listeners: [EventTarget, string, (e: never) => void][] = [
      [document, 'pointermove', point],
      [
        document,
        'pointerdown',
        (e: MouseEvent) => {
          point(e);
          input.down = true;
        }
      ],
      [
        document,
        'pointerup',
        () => {
          input.down = false;
        }
      ],
      [
        document,
        'keydown',
        (e: KeyboardEvent) => {
          input.keys.add(e.code || e.key);
        }
      ],
      [
        document,
        'keyup',
        (e: KeyboardEvent) => {
          input.keys.delete(e.code || e.key);
        }
      ],
      [
        window,
        'message',
        (e: MessageEvent) => {
          const m = e.data as Forwarded;
          if (m?.type === cfg.eventMessage) {
            forward(m, area);
          }
          if (m?.type === cfg.inputMessage && m.values) {
            input.tiltX = m.values[cfg.tilt.x] ?? input.tiltX;
            input.tiltY = m.values[cfg.tilt.y] ?? input.tiltY;
          }
        }
      ]
    ];
    for (const [target, type, fn] of listeners) {
      target.addEventListener(type, fn as EventListener);
    }
    liveRuns.push(() => listeners.forEach(([target, type, fn]) => target.removeEventListener(type, fn as EventListener)));
  };

  const onScreen = (root: HTMLElement) => {
    const el = root as HTMLElement & { checkVisibility?: (o: object) => boolean };
    return !document.hidden && el.isConnected && el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false;
  };
  const liveClock = (root: HTMLElement, hooks: Hooks) => {
    const timers = new Set<number>();
    const frames = new Set<number>();
    let held: FrameRequestCallback[] = [];
    let paused = false;
    let alive = true;
    const frame = (f: FrameRequestCallback): number => {
      const id: number = requestAnimationFrame((now) => {
        frames.delete(id);
        if (!alive) {
          return;
        }
        if (!onScreen(root)) {
          held.push(f);
          return;
        }
        f(now);
      });
      frames.add(id);
      return id;
    };
    const watch = () => {
      if (!alive) {
        return;
      }
      const hidden = !onScreen(root);
      if (hidden !== paused) {
        paused = hidden;
        (paused ? hooks.pause : hooks.resume).forEach((fn) => fn());
      }
      if (!paused && held.length) {
        held.splice(0).forEach((f) => frame(f));
      }
      requestAnimationFrame(watch);
    };
    const timer =
      (schedule: (fn: () => void, ms?: number) => unknown) =>
      (fn: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
        const id = schedule(() => alive && fn(...rest), ms) as number;
        timers.add(id);
        return id;
      };
    const destroy = () => {
      alive = false;
      frames.forEach((id) => cancelAnimationFrame(id));
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      hooks.destroy.forEach((fn) => fn());
    };
    requestAnimationFrame(watch);
    return {
      destroy,
      shadows: {
        setTimeout: timer(setTimeout),
        setInterval: timer(setInterval),
        setImmediate: timer(setTimeout),
        requestAnimationFrame: frame,
        requestIdleCallback: (fn: () => void) => timer(setTimeout)(fn, 1),
        queueMicrotask: (fn: () => void) => queueMicrotask(() => alive && fn()),
        performance,
        Math,
        Date
      } as Record<string, unknown>
    };
  };
  const stillClock = (seed: number) => {
    Math.random = seeded(seed);
    const frames: FrameRequestCallback[] = [];
    const never = () => 0;
    const frozenDate = new Proxy(Date, {
      construct: (target, args) => new target(...((args.length ? args : [0]) as [number])),
      apply: () => new Date(0).toString(),
      get: (target, key) => (key === 'now' ? () => 0 : Reflect.get(target, key))
    });
    return {
      flush: () => frames.splice(0).forEach((f) => f(0)),
      shadows: {
        setTimeout: never,
        setInterval: never,
        setImmediate: never,
        requestAnimationFrame: (f: FrameRequestCallback) => frames.push(f),
        requestIdleCallback: never,
        queueMicrotask: never,
        performance: { now: () => 0 },
        Math: Object.create(Math, { random: { value: seeded(seed) } }),
        Date: frozenDate
      } as Record<string, unknown>
    };
  };
  const shadowsWith = (clock: Record<string, unknown>) => cfg.shadowed.map((name) => (cfg.clock.includes(name) ? clock[name] : undefined));

  const onError = (e: Event) => errors.push({ clip: '', component: '', message: String((e as ErrorEvent).message ?? e) });
  removeEventListener('error', w[cfg.listener] as EventListener);
  w[cfg.listener] = onError;
  addEventListener('error', onError);

  const sketches = (P5: SketchClass, { root, tl, run }: ClipScope) => (sketch: (p: Sketch) => void) => {
    const reseed = (p: Sketch) => {
      p.randomSeed(run.seed);
      p.noiseSeed(run.seed);
    };
    const instance = new P5((p) => {
      sketch(p);
      const setup = p.setup;
      p.setup = () => {
        p.noLoop();
        reseed(p);
        setup?.call(p);
      };
    }, root);
    tl.to({}, { duration: run.length + (run.trim ?? 0), ease: 'none', onUpdate: () => {
      instance.frameCount = Math.round(tl.time() * run.fps) - 1;
      reseed(instance);
      instance.redraw();
    } }, 0);
    return instance;
  };
  const frozenSketches = (P5: SketchClass, { root }: ClipScope) => (sketch: (p: Sketch) => void) =>
    new P5((p) => {
      sketch(p);
      const setup = p.setup;
      p.setup = () => {
        p.noLoop();
        setup?.call(p);
      };
    }, root);
  const liveSketches = (P5: new (sketch: (p: Sketch) => void, node: HTMLElement) => Sketch & { loop: () => void; remove: () => void }, { root, hooks }: ClipScope) => (sketch: (p: Sketch) => void) => {
    const instance = new P5(sketch, root);
    hooks.pause.push(() => instance.noLoop());
    hooks.resume.push(() => instance.loop());
    hooks.destroy.push(() => instance.remove());
    return instance;
  };
  const littleGames =
    (frozen: boolean) =>
    (L: Little, { root, hooks }: ClipScope) =>
      Object.create(L, {
        engineInit: {
          value: (init: unknown, update: unknown, updatePost: unknown, render: unknown, renderPost: unknown, images: unknown[] = []) => {
            L.setCanvasFixedSize(L.vec2(root.clientWidth, root.clientHeight));
            if (frozen) {
              L.setEngineManualStep(true);
            }
            hooks.pause.push(() => L.setEngineManualStep(true));
            hooks.resume.push(() => L.setEngineManualStep(false));
            hooks.destroy.push(() => {
              L.setEngineManualStep(true);
              L.engineObjectsDestroy();
              root.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
            });
            const started = L.engineInit(init, update, updatePost, render, renderPost, images, root);
            return frozen ? started.then(() => L.engineStep(1)) : started;
          }
        }
      });
  const kaplayGames =
    (frozen: boolean) =>
    (make: (options: object) => Game, { root, run, hooks }: ClipScope) =>
    (options: object = {}) => {
      const game = make({ ...options, global: false, root, width: root.clientWidth, height: root.clientHeight });
      hooks.pause.push(() => (game.debug.paused = true));
      hooks.resume.push(() => (game.debug.paused = false));
      hooks.destroy.push(() => game.quit());
      if (frozen) {
        game.randSeed(run.seed);
        game.onDraw(() => (game.debug.paused = true));
      }
      return game;
    };
  type Wrap = (lib: never, scope: ClipScope) => unknown;
  const raw: Wrap = (lib) => lib;
  const played = (play: string) => ({ seeked: wraps, live: { ...wraps, p5: liveSketches, PIXI: raw, Matter: raw, LittleJS: littleGames(false), kaplay: kaplayGames(false) }, still: { ...wraps, p5: frozenSketches, LittleJS: littleGames(true), kaplay: kaplayGames(true) } })[play] as Record<string, Wrap>;

  const stages = (PIXI: Stage) =>
    Object.create(PIXI, {
      Application: {
        value: class extends PIXI.Application {
          constructor(options: object) {
            super({ ...options, autoStart: false, sharedTicker: false, preserveDrawingBuffer: true });
          }
        }
      }
    });
  const worlds = (Matter: Physics, { run }: ClipScope) => {
    const seekable = (engine: World) => {
      Matter.Common._seed = run.seed;
      const step = 1000 / run.fps;
      const last = Math.ceil((run.length + (run.trim ?? 0)) * run.fps);
      const poses: Map<Body, Pose>[] = [];
      const record = () => poses.push(new Map(Matter.Composite.allBodies(engine.world).map((b) => [b, { x: b.position.x, y: b.position.y, angle: b.angle }])));
      record();
      return (t: number) => {
        const frame = Math.min(last, Math.max(0, Math.round(t * run.fps)));
        while (poses.length <= frame) {
          Matter.Engine.update(engine, step);
          record();
        }
        return poses[frame];
      };
    };
    return Object.create(Matter, { seekable: { value: seekable }, Runner: { value: undefined }, Render: { value: undefined } });
  };
  const utilities = ({ createNoise2D, createNoise3D, createNoise4D, PoissonDiskSampling, ...geometry }: Generative, { run }: ClipScope) => {
    let salt = 0;
    const random = () => seeded(run.seed + ++salt);
    return {
      ...geometry,
      noise2D: () => createNoise2D(random()),
      noise3D: () => createNoise3D(random()),
      noise4D: () => createNoise4D(random()),
      poisson: (options: object) => new PoissonDiskSampling(options, random())
    };
  };
  const shaders = (twgl: object) => ({ ...twgl, webgl: (canvas: HTMLCanvasElement) => canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true }) });
  const effects = (fx: (clip: object) => unknown, { tl, run }: ClipScope) => fx({ tl, length: run.length + (run.trim ?? 0), seed: run.seed });
  const tokens = (openProps: (clip: object) => unknown, { tl }: ClipScope) => openProps({ tl, registerEase: engine.registerEase });
  const splits = ({ Splitting }: { Splitting: (options: Split) => unknown }, { root, tl, run }: ClipScope) => {
    const scoped = ({ target = '[data-splitting]', ...options }: Split = {}) => Splitting({ ...options, target: typeof target === 'string' ? root.querySelectorAll(target) : target });
    const drive = (el: HTMLElement, { at = 0, duration = run.length + (run.trim ?? 0) - at, ease = 'none' }: { at?: number; duration?: number; ease?: string } = {}) => {
      el.style.setProperty('--split', '0');
      tl.fromTo(el, { '--split': 0 }, { '--split': 1, duration, ease, immediateRender: false }, at);
      return el;
    };
    return Object.assign(scoped, { drive });
  };
  const wraps: Record<string, (lib: never, scope: ClipScope) => unknown> = { p5: sketches, PIXI: stages, Matter: worlds, gen: utilities, twgl: shaders, fx: effects, Splitting: splits, OpenProps: tokens };
  const libraries = Object.entries(cfg.libraries).map(([name, global]) => [name, w[global] ?? null] as const);
  const clipLibraries = (scope: ClipScope) => {
    const wrapped = played(scope.run.play ?? 'seeked');
    return Object.fromEntries(libraries.map(([name, lib]) => [name, lib && wrapped[name] ? wrapped[name](lib as never, scope) : lib]));
  };
  if (runs.some((r) => r.play === 'live')) {
    listenInput(document.getElementById('root') ?? document.body);
  }

  for (const run of runs) {
    const root = document.getElementById(`cc-${run.id}`);
    const make = registry[run.name];
    if (!root || !make) {
      errors.push({ clip: run.id, component: run.name, message: 'the component code did not load (syntax error?)' });
      continue;
    }
    const child = engine.timeline();
    const values = { ...run.values };
    const cssVar = (key: string) => `--param-${key}`;
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'number' || typeof value === 'string') {
        root.style.setProperty(cssVar(key), String(value));
      }
    }
    const trim = run.trim ?? 0;
    const sampled = (track: ParamKey[]) => {
      const t = child.time() - trim;
      const next = track.findIndex((k) => k.at > t);
      if (next <= 0) {
        return next === 0 ? track[0].value : track[track.length - 1].value;
      }
      const a = track[next - 1];
      const b = track[next];
      return engine.utils.interpolate(a.value, b.value, engine.parseEase(a.ease)((t - a.at) / (b.at - a.at)));
    };
    for (const [key, track] of Object.entries(run.keys ?? {})) {
      Object.defineProperty(values, key, { get: () => sampled(track), enumerable: true });
      root.style.setProperty(cssVar(key), String(track[0].value));
      child.set(root, { [cssVar(key)]: track[0].value }, trim);
      for (let i = 0; i + 1 < track.length; i++) {
        const a = track[i];
        const b = track[i + 1];
        child.fromTo(root, { [cssVar(key)]: a.value }, { [cssVar(key)]: b.value, duration: Math.max(0.0001, b.at - a.at), ease: a.ease, immediateRender: false, lazy: false }, a.at + trim);
      }
    }
    const param = (name: string, fallback: unknown) => (name in values ? values[name] : fallback);
    const hooks: Hooks = { pause: [], resume: [], destroy: [] };
    const live = run.play === 'live' ? liveClock(root, hooks) : null;
    const still = run.play === 'still' ? stillClock(run.seed) : null;
    if (live) {
      liveRuns.push(live.destroy);
    }
    const shadows = live ? shadowsWith(live.shadows) : still ? shadowsWith(still.shadows) : seekedShadows;
    const lifecycle = { input, onPause: (fn: () => void) => hooks.pause.push(fn), onResume: (fn: () => void) => hooks.resume.push(fn), onDestroy: (fn: () => void) => hooks.destroy.push(fn) };
    try {
      const made = make(
        { root, props: values, tl: child, param, duration: run.length, fps: run.fps, assets: env.assets, brand: env.brand, rand: seeded(run.seed), format, motion: engine, gsap: engine, SplitText: engine.SplitText, ...lifecycle, ...clipLibraries({ root, tl: child, run, hooks }) },
        ...shadows
      ) as { still?: (t: number) => void } | undefined;
      still?.flush();
      const draw = made?.still;
      if (still && typeof draw === 'function') {
        child.to({}, { duration: run.length + trim, ease: 'none', onUpdate: () => draw(child.time() - trim) }, 0);
      }
    } catch (e) {
      errors.push({ clip: run.id, component: run.name, message: e instanceof Error ? e.message : String(e) });
      root.setAttribute('data-error', '');
    }
    child.set({}, {}, run.length + trim);
    if (!trim) {
      master.add(child, run.start);
      continue;
    }
    master.add(child.tweenFromTo(trim, trim + run.length, { duration: run.length, ease: 'none', immediateRender: false }), run.start);
  }
}

export function bootScript(runs: CustomRun[], env: CustomEnv, master: string): string {
  if (!runs.length) {
    return '';
  }
  const cfg: BootConfig = { registry: REGISTRY, errors: ERRORS, listener: ERROR_LISTENER, libraries: GLOBALS, engine: ENGINE_GLOBAL, shadowed: [...SHADOWED], clock: CLOCK_SHADOWS, liveRuns: LIVE_RUNS, eventMessage: EVENT_MESSAGE, inputMessage: INPUT_MESSAGE, tilt: { x: InputKey.TiltX, y: InputKey.TiltY } };
  return `(${bootCustom.toString()})(${js(cfg)},${js(runs)},${js(env)},${master},(${fixedFormat.toString()})());`;
}
