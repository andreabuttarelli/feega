import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { precompose } from '@feega/motion-core/motion/precomp';
import { boxBook } from '$lib/motion/gpu-full/text/test-face';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { sequenceScenes } from '$lib/motion/scenes';
import { keepLocalFiles, forgetLocalFiles } from '@feega/motion-core/motion/fonts/local-files';
import { itemWire } from '@feega/motion-core/motion/gpu-full/wire';
import type { DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';
import { builtAnswer, buildFrame, frameBuilder, transfers, type BuildAsk, type BuildWorker } from './frame-build';
import { itemPack, listPack } from '@feega/motion-core/motion/gpu-full/wire';

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

  it('leaves a template wrapped in a precomp to the main thread too', async () => {
    const template = must(precompose(customDoc, ['card'], { comp: 'tpl', clip: 'pc' }, 'Template'));
    expect(await buildFrame(source(template), Smoothing.Plain, fonts)).toBeNull();
  });

  it('leaves a combined video to the main thread, which resolves its scenes', async () => {
    const combined = sequenceScenes(blank, [{ nodeId: '00000000-0000-4000-8000-000000000001', durationInFrames: 60 }]);
    expect(await buildFrame(source(combined), Smoothing.Plain, fonts)).toBeNull();
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
    const [a, b] = await Promise.all([build(source(shapeDoc), Smoothing.Plain), build(source(customDoc), Smoothing.Plain)]);
    expect(worker.asked.map((a) => a.source.doc)).toEqual([shapeDoc, customDoc]);
    expect(a?.width).toBe(1);
    expect(b?.width).toBe(1);
  });

  it('hands the worker the local font files it cannot see from its own thread', async () => {
    keepLocalFiles('Avenir Next', [{ url: 'blob:x', weight: 400, italic: false }]);
    const worker = echo();
    await frameBuilder(() => worker)(source(shapeDoc), Smoothing.Plain);
    forgetLocalFiles();

    expect(worker.asked[0].locals).toEqual([['Avenir Next', [{ url: 'blob:x', weight: 400, italic: false }]]]);
  });

  it('a worker that dies fails what it was building and is not asked again', async () => {
    const dead = { onmessage: null, onerror: null as BuildWorker['onerror'], postMessage: () => queueMicrotask(() => dead.onerror?.(new Event('error') as never)) };
    let spawned = 0;
    const build = frameBuilder(() => (spawned++, dead));
    await expect(build(source(shapeDoc), Smoothing.Plain)).rejects.toThrow();
    await expect(build(source(shapeDoc), Smoothing.Plain)).rejects.toThrow();
    expect(spawned).toBe(1);
  });

  it('the worker sends each item already wired, so the main thread never serialises it', async () => {
    const list = (await buildFrame(source(shapeDoc), Smoothing.Plain, fonts)) as DisplayList;
    const answer = builtAnswer(7, list);

    expect(answer).toEqual({ id: 7, list, wires: list.items.map((i) => JSON.stringify(i)), packs: list.items.map(itemPack) });
  });

  it('the main thread keeps the wires the worker sent with the list', async () => {
    const item = { kind: 'path', clip: 'card' };
    const worker = {
      onerror: null,
      onmessage: null as BuildWorker['onmessage'],
      postMessage: (ask: BuildAsk) => queueMicrotask(() => worker.onmessage?.({ data: { id: ask.id, list: { width: 1, height: 1, background: null, items: [item], unsupported: [] }, wires: ['"from the worker"'] } } as never))
    };

    const list = await frameBuilder(() => worker)(source(shapeDoc), Smoothing.Plain);

    expect(itemWire(list!.items[0])).toBe('"from the worker"');
  });

  it('the main thread keeps the packs the worker sent with the list', async () => {
    const item = { kind: 'path', clip: 'card', contours: [[1, 2]] } as never;
    const pack = itemPack({ kind: 'path', clip: 'card', contours: [[7, 8]] } as never);
    const worker = {
      onerror: null,
      onmessage: null as BuildWorker['onmessage'],
      postMessage: (ask: BuildAsk) => queueMicrotask(() => worker.onmessage?.({ data: { id: ask.id, list: { width: 1, height: 1, background: null, items: [item], unsupported: [] }, wires: ['""'], packs: [pack] } } as never))
    };

    const list = await frameBuilder(() => worker)(source(shapeDoc), Smoothing.Plain);

    expect([...listPack(list!).floats]).toEqual([7, 8]);
  });

  it('lists the pack buffers so the worker can transfer them instead of copying', async () => {
    const list = (await buildFrame(source(shapeDoc), Smoothing.Plain, fonts)) as DisplayList;
    const answer = builtAnswer(7, list);

    expect(transfers(answer)).toHaveLength(list.items.length * 2);
  });

  it('says it cannot build when no worker can start', async () => {
    const build = frameBuilder(() => null);
    await expect(build(source(shapeDoc), Smoothing.Plain)).rejects.toThrow();
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
