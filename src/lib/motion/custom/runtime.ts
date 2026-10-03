import { contentStamp } from '../stamp';
import { js } from '../hyperframes/html';
import type { CustomComponents } from './component';

export const REGISTRY = '__feegaComponents';
export const ERRORS = '__feegaErrors';
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
  SplitText = 'SplitText',
  Lottie = 'lottie',
  Three = 'THREE'
}

const USES: Record<Library, RegExp> = {
  [Library.SplitText]: /\bSplitText\b/,
  [Library.Lottie]: /\blottie\b/,
  [Library.Three]: /\bTHREE\b/
};

export function librariesOf(components: CustomComponents, used: Iterable<string>): Set<Library> {
  const code = [...used].map((name) => components[name]?.source.js ?? '').join('\n');
  return new Set((Object.keys(USES) as Library[]).filter((lib) => USES[lib].test(code)));
}

export type CustomRun = { id: string; name: string; start: number; length: number; fps: number; values: Record<string, unknown>; seed: number };

export type CustomEnv = { assets: Record<string, string>; brand: { name: string; colors: Record<string, string>; logoUrl: string | null } };

export function seedOf(clipId: string): number {
  return parseInt(contentStamp(clipId).split('-')[0], 36) >>> 0;
}

export function definitionScript(name: string, code: string): string {
  const body = code.replace(/<\/(script)/gi, '<\\/$1');
  return `<script>(window.${REGISTRY}=window.${REGISTRY}||{})[${js(name)}]=function(ctx,${SHADOWED.join(',')}){"use strict";const {root,props,tl,duration,fps,assets,brand,rand,gsap,SplitText,lottie,THREE}=ctx;\n${body}\n};</script>`;
}

type BootWindow = Window & Record<string, unknown> & { gsap: { timeline: () => Timeline } };
type Timeline = { set: (t: object, v: object, at: number) => void; add: (child: Timeline, at: number) => void };
type ClipError = { clip: string; component: string; message: string };

function bootCustom(cfg: { registry: string; errors: string; three: string; shadowed: string[] }, runs: CustomRun[], env: CustomEnv, master: Timeline) {
  const w = window as unknown as BootWindow;
  const errors = ((w[cfg.errors] as ClipError[] | undefined) ??= []);
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

  addEventListener('error', (e) => errors.push({ clip: '', component: '', message: String((e as ErrorEvent).message ?? e) }));

  for (const run of runs) {
    const root = document.getElementById(`cc-${run.id}`);
    const make = registry[run.name];
    if (!root || !make) {
      errors.push({ clip: run.id, component: run.name, message: 'the component code did not load (syntax error?)' });
      continue;
    }
    const child = w.gsap.timeline();
    try {
      make(
        { root, props: run.values, tl: child, duration: run.length, fps: run.fps, assets: env.assets, brand: env.brand, rand: seeded(run.seed), gsap: w.gsap, SplitText: w.SplitText ?? null, lottie: w.lottie ?? null, THREE: w[cfg.three] ?? null },
        ...shadows
      );
    } catch (e) {
      errors.push({ clip: run.id, component: run.name, message: e instanceof Error ? e.message : String(e) });
      root.setAttribute('data-error', '');
    }
    child.set({}, {}, run.length);
    master.add(child, run.start);
  }
}

export function bootScript(runs: CustomRun[], env: CustomEnv, master: string): string {
  if (!runs.length) {
    return '';
  }
  const cfg = { registry: REGISTRY, errors: ERRORS, three: THREE_GLOBAL, shadowed: [...SHADOWED] };
  return `(${bootCustom.toString()})(${js(cfg)},${js(runs)},${js(env)},${master});`;
}
