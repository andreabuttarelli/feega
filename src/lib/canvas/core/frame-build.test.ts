import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { boxBook } from '$lib/motion/gpu-full/text/test-face';
import { Smoothing } from '$lib/motion/gpu-full/text/painter';
import { buildFrame, frameBuilder, type BuildAsk, type BuildWorker } from './frame-build';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const square = { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' };
const blank = newMotionDoc(MotionFormat.Landscape);
const shapeDoc = must(addClip(blank, { component: 'Shape', from: 0, durationInFrames: blank.durationInFrames, props: square }, 'card'));
const customDoc: MotionDoc = { ...shapeDoc, tracks: shapeDoc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, component: 'Custom' })) })) };
const source = (doc: MotionDoc) => ({ revision: 1, doc, assets: {}, tokens: FEEGA_TOKENS });
const fonts = async () => boxBook();

describe('building a frame away from the main thread', () => {
  it('turns a saved doc into the list of its still frame', async () => {
    const list = await buildFrame(source(shapeDoc), Smoothing.Plain, fonts);
    expect(list?.items.map((i) => i.clip)).toContain('card');
  });

  it('leaves a doc that needs the DOM reader to the main thread', async () => {
    expect(await buildFrame(source(customDoc), Smoothing.Plain, fonts)).toBeNull();
  });

  it('the list survives the trip between threads unchanged', async () => {
    const list = await buildFrame(source(shapeDoc), Smoothing.Plain, fonts);
    expect(structuredClone(list)).toEqual(list);
  });
});

describe('the builder', () => {
  const echo = (): BuildWorker & { asked: BuildAsk[] } => {
    const worker = {
      onerror: null,
      asked: [] as BuildAsk[],
      onmessage: null as BuildWorker['onmessage'],
      postMessage(ask: BuildAsk) {
        worker.asked.push(ask);
        queueMicrotask(() => worker.onmessage?.({ data: { id: ask.id, list: { width: 1, height: 1, background: null, items: [], unsupported: [] } } } as never));
      }
    };
    return worker;
  };

  it('answers each request with its own list', async () => {
    const worker = echo();
    const build = frameBuilder(() => worker);
    const [a, b] = await Promise.all([build('/a', Smoothing.Plain), build('/b', Smoothing.Plain)]);
    expect(worker.asked.map((a) => a.url)).toEqual(['/a', '/b']);
    expect(a?.width).toBe(1);
    expect(b?.width).toBe(1);
  });

  it('a worker that dies fails what it was building and is not asked again', async () => {
    const dead = { onmessage: null, onerror: null as BuildWorker['onerror'], postMessage: () => queueMicrotask(() => dead.onerror?.(new Event('error') as never)) };
    let spawned = 0;
    const build = frameBuilder(() => (spawned++, dead));
    await expect(build('/a', Smoothing.Plain)).rejects.toThrow();
    await expect(build('/b', Smoothing.Plain)).rejects.toThrow();
    expect(spawned).toBe(1);
  });

  it('says it cannot build when no worker can start', async () => {
    const build = frameBuilder(() => null);
    await expect(build('/a', Smoothing.Plain)).rejects.toThrow();
  });
});

describe('the frame worker', () => {
  const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const STATIC_IMPORT = /^(?:import|export)\s[^;]*?from\s+'([^']+)'/gm;
  const APP_ONLY = /^\$(app|env)\//;
  const LOCAL = /^(\.|\$lib\/)/;
  const fileOf = (from: string, spec: string) => {
    const base = spec.startsWith('$lib/') ? resolve(LIB, spec.slice('$lib/'.length)) : resolve(dirname(from), spec);
    return [base, `${base}.ts`, `${base}/index.ts`].find((f) => f.endsWith('.ts') && existsSync(f));
  };

  function appImports(entry: string): string[] {
    const seen = new Set<string>();
    const found: string[] = [];
    const walk = (file: string) => {
      if (seen.has(file)) {
        return;
      }
      seen.add(file);
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
        if (APP_ONLY.test(spec)) {
          found.push(`${file.slice(LIB.length)} -> ${spec}`);
          continue;
        }
        const next = LOCAL.test(spec) ? fileOf(file, spec) : undefined;
        if (next) {
          walk(next);
        }
      }
    };
    walk(entry);
    return found;
  }

  it('reaches no module that only runs inside the app page', () => {
    expect(appImports(resolve(LIB, 'canvas/core/frame-build.worker.ts'))).toEqual([]);
  });
});
