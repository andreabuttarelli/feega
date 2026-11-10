import { describe, expect, it, vi } from 'vitest';
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
import { builtAnswer, buildFrame, frameBuilder, playingBuilder, transfers, type BuildAsk, type BuildWorker } from './frame-build';
import { itemPack, listPack } from '@feega/motion-core/motion/gpu-full/wire';
import { onStage } from './frame-source';
import { withoutPictures } from './placeholders';
import { FrameKind } from '$lib/canvas/motion-node';

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
    expect(worker.asked.map((a) => (JSON.parse(a.source) as { doc: unknown }).doc)).toEqual([shapeDoc, customDoc]);
    expect(worker.asked.every((a) => typeof a.source === 'string')).toBe(true);
    expect(a?.width).toBe(1);
    expect(b?.width).toBe(1);
  });

  it('writes a doc out once, not again when the frame rebuilds with sharper assets', async () => {
    const worker = echo();
    const build = frameBuilder(() => worker);
    const written = vi.spyOn(JSON, 'stringify');
    const doc = structuredClone(shapeDoc);

    await build({ ...source(doc), assets: { a: 'small' } }, Smoothing.Plain);
    await build({ ...source(doc), assets: { a: 'large' } }, Smoothing.Plain);
    const docWrites = written.mock.calls.filter(([value]) => value === doc || (value as { doc?: unknown })?.doc === doc).length;
    written.mockRestore();

    expect(docWrites).toBe(1);
    expect(worker.asked.map((a) => JSON.parse(a.source))).toEqual([{ ...source(doc), assets: { a: 'small' } }, { ...source(doc), assets: { a: 'large' } }].map((x) => JSON.parse(JSON.stringify(x))));
  });

  it('spreads builds over its workers, so frames build side by side instead of in one queue', async () => {
    const workers = [echo(), echo(), echo()];
    let spawned = 0;
    const build = frameBuilder(() => workers[spawned++], 3);
    await Promise.all([1, 2, 3].map(() => build(source(shapeDoc), Smoothing.Plain)));
    expect(workers.map((w) => w.asked.length)).toEqual([1, 1, 1]);
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

  it('sends contours in transferred buffers, not as nested arrays (copying them cost 0.7 s at 4x on open)', async () => {
    const list = (await buildFrame(source(shapeDoc), Smoothing.Plain, fonts)) as DisplayList;
    const answer = builtAnswer(7, list);
    const sent = JSON.stringify((answer as { list: DisplayList }).list.items, (key, value) => (key === 'contours' && Array.isArray(value) ? 'NESTED' : value));

    expect(sent).not.toContain('NESTED');
    expect(transfers(answer).length).toBeGreaterThan(0);
  });

  it('a staged or placeholder-rebuilt item still draws its shapes after the trip', async () => {
    const list = (await buildFrame(source(shapeDoc), Smoothing.Plain, fonts)) as DisplayList;
    const whole = listPack(structuredClone(list));
    const answer = builtAnswer(7, list);
    const arrived = structuredClone(answer, { transfer: transfers(answer) }) as { list: DisplayList };
    const rebuilt = onStage(withoutPictures({ ...arrived.list, bleed: 3 }, { paper: '#fff', line: '#eee' }), FrameKind.Frame);

    expect([...listPack(rebuilt).floats].length).toBe([...whole.floats].length);
    expect([...listPack(arrived.list).floats]).toEqual([...whole.floats]);
    expect(itemWire(arrived.list.items[0])).toBe(itemWire(structuredClone(list).items[0]));
  });

  it('says it cannot build when no worker can start', async () => {
    const build = frameBuilder(() => null);
    await expect(build(source(shapeDoc), Smoothing.Plain)).rejects.toThrow();
  });
});

describe('playing a frame', () => {
  const ask = (playhead: number) => ({ id: playhead, source: JSON.stringify(source(shapeDoc)), playhead, smoothing: Smoothing.Plain, locals: [] });

  it('prepares a doc once and only draws each new playhead', async () => {
    const faces = vi.fn(fonts);
    const build = playingBuilder(faces);

    await build(ask(0));
    await build(ask(10));
    await build(ask(20));

    expect(faces).toHaveBeenCalledTimes(1);
  });

  it('prepares again when the doc changes', async () => {
    const faces = vi.fn(fonts);
    const build = playingBuilder(faces);

    await build(ask(0));
    await build({ ...ask(0), source: JSON.stringify(source(blank)) });

    expect(faces).toHaveBeenCalledTimes(2);
  });

  it('draws the playhead it is asked for', async () => {
    const build = playingBuilder(fonts);

    expect(await build(ask(5))).toEqual(await buildFrame({ ...source(shapeDoc), playhead: 5 }, Smoothing.Plain, fonts));
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
