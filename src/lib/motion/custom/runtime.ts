import { contentStamp } from '../stamp';
import { js } from '../hyperframes/html';
import type { CustomComponents } from './component';
import { ENGINE_GLOBAL } from '../engine/engine';
import { fixedFormat } from './format';

export const REGISTRY = '__feegaComponents';
export const ERRORS = '__feegaErrors';
const ERROR_LISTENER = '__feegaErrorListener';
export const THREE_GLOBAL = '__feegaThree';

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
  Three = 'THREE'
}

const USES: Record<Library, RegExp> = {
  [Library.Lottie]: /\blottie\b/,
  [Library.Three]: /\bTHREE\b/
};

export function librariesOf(components: CustomComponents, used: Iterable<string>): Set<Library> {
  const code = [...used].map((name) => components[name]?.source.js ?? '').join('\n');
  return new Set((Object.keys(USES) as Library[]).filter((lib) => USES[lib].test(code)));
}

export type ParamKey = { at: number; value: number | string; ease: string };
export type CustomRun = { id: string; name: string; start: number; length: number; fps: number; values: Record<string, unknown>; seed: number; keys?: Record<string, ParamKey[]>; trim?: number };

export type CustomEnv = { assets: Record<string, string>; brand: { name: string; colors: Record<string, string>; logoUrl: string | null } };

export function seedOf(clipId: string): number {
  return parseInt(contentStamp(clipId).split('-')[0], 36) >>> 0;
}

export function definitionScript(name: string, code: string): string {
  const body = code.replace(/<\/(script)/gi, '<\\/$1');
  return `<script>(window.${REGISTRY}=window.${REGISTRY}||{})[${js(name)}]=function(ctx,${SHADOWED.join(',')}){"use strict";const {root,props,tl,duration,fps,assets,brand,rand,param,format,motion,gsap,SplitText,lottie,THREE}=ctx;{\n${body}\n}};</script>`;
}

type Engine = { timeline: () => Timeline; parseEase: (ease: string) => (p: number) => number; utils: { interpolate: (a: unknown, b: unknown, p: number) => unknown }; split: unknown; SplitText: unknown };
type BootWindow = Window & Record<string, unknown>;
type Timeline = { time: () => number; set: (t: object, v: object, at: number) => void; add: (child: object, at: number) => void; fromTo: (t: object, a: object, b: object, at: number) => void; tweenFromTo: (from: number, to: number, vars: object) => object };
type ClipError = { clip: string; component: string; message: string };

function bootCustom(cfg: { registry: string; errors: string; listener: string; three: string; engine: string; shadowed: string[] }, runs: CustomRun[], env: CustomEnv, master: Timeline, format: ReturnType<typeof fixedFormat>) {
  const w = window as unknown as BootWindow;
  const engine = w[cfg.engine] as Engine;
  const errors: ClipError[] = [];
  w[cfg.errors] = errors;
  const registry = (w[cfg.registry] ?? {}) as Record<string, (ctx: object, ...shadows: unknown[]) => void>;
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
  const shadows = cfg.shadowed.map((name) => (name === 'Math' ? safeMath : name === 'Date' ? safeDate : undefined));
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

  const onError = (e: Event) => errors.push({ clip: '', component: '', message: String((e as ErrorEvent).message ?? e) });
  removeEventListener('error', w[cfg.listener] as EventListener);
  w[cfg.listener] = onError;
  addEventListener('error', onError);

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
    try {
      make(
        { root, props: values, tl: child, param, duration: run.length, fps: run.fps, assets: env.assets, brand: env.brand, rand: seeded(run.seed), format, motion: engine, gsap: engine, SplitText: engine.SplitText, lottie: w.lottie ?? null, THREE: w[cfg.three] ?? null },
        ...shadows
      );
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
  const cfg = { registry: REGISTRY, errors: ERRORS, listener: ERROR_LISTENER, three: THREE_GLOBAL, engine: ENGINE_GLOBAL, shadowed: [...SHADOWED] };
  return `(${bootCustom.toString()})(${js(cfg)},${js(runs)},${js(env)},${master},(${fixedFormat.toString()})());`;
}
