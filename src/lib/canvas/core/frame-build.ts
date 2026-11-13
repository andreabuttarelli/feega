import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare, type DisplayList, type Prepared } from '@feega/motion-core/motion/gpu-full/display-list';
import { readClips } from '@feega/motion-core/motion/gpu-full/dom/custom';
import { stripContours, type ContourView } from '@feega/motion-core/motion/gpu-full/wire';
import { localFilesSnapshot, type LocalFilesSnapshot } from '@feega/motion-core/motion/fonts/local-files';
import type { FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import type { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { sceneNodeIds } from '$lib/motion/scenes';
import { frameOfLive } from './frame-source';
import { viewsOfFrame } from '$lib/canvas/breakpoint-views';
import { tieredAssets } from './tiered-assets';
import { AssetSize } from '$lib/canvas/asset-url';
import type { Box } from './canvas-scene';

export type FrameDoc = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens; playhead?: number; addresses?: Record<string, string> };

export type Fonts = (doc: MotionDoc, assets: Record<string, string>, tokens: BrandTokens) => Promise<FaceBook>;

export type ShotFrame = { id: string; kind: string; revision: number; box: Box };

export type ShotOf = { url: string; frame: ShotFrame; place: { projectId: string; canvasId: string } | null };

export type Shot = { frame: ShotFrame; list: DisplayList };

export type BuildAsk = { id: number; source: string; playhead?: number; smoothing: Smoothing; locals: LocalFilesSnapshot; shot?: ShotOf };

export type BuildAnswer = { id: number; list: DisplayList | null; contours?: ContourView } | { id: number; shots: Shot[] | null; buffers: ArrayBuffer[] } | { id: number; error: string };

export type BuildWorker = { postMessage: (ask: BuildAsk) => void; onmessage: ((e: MessageEvent<BuildAnswer>) => void) | null; onerror: ((e: ErrorEvent) => void) | null; terminate?: () => void };

const MAIN_THREAD_ONLY: ((source: FrameDoc) => boolean)[] = [(source) => readClips(source.doc, source.tokens.logoUrl).read.length > 0, (source) => sceneNodeIds(source.doc).length > 0];

export async function buildFrame(source: FrameDoc, smoothing: Smoothing, fonts: Fonts): Promise<DisplayList | null> {
  if (MAIN_THREAD_ONLY.some((needs) => needs(source))) {
    return null;
  }
  const faces = await fonts(source.doc, source.assets, source.tokens);
  const prepared = prepare(source.doc, source.tokens, source.assets, { fonts: faces, smoothing });
  return drawFrame(prepared, frameOfLive(source));
}

export async function shotLists(source: FrameDoc, frame: ShotFrame, smoothing: Smoothing, fonts: Fonts): Promise<Shot[] | null> {
  if (MAIN_THREAD_ONLY.some((needs) => needs(source))) {
    return null;
  }
  const faces = await fonts(source.doc, source.assets, source.tokens);
  const drawn = (doc: MotionDoc) => drawFrame(prepare(doc, source.tokens, source.assets, { fonts: faces, smoothing }), frameOfLive({ ...source, doc }));
  const views = source.doc.breakpoints?.length ? viewsOfFrame(frame as never, source.doc) : [];
  return [{ frame, list: drawn(source.doc) }, ...views.map((v) => ({ frame: v.frame, list: drawn(v.doc) }))];
}

export async function shotAway(ask: ShotOf, smoothing: Smoothing, fonts: Fonts): Promise<Shot[] | null> {
  const res = await fetch(ask.url, { cache: 'no-cache' });
  const fetched = res.ok ? ((await res.json()) as FrameDoc | null) : null;
  if (!fetched) {
    return null;
  }
  return shotLists(ask.place ? tieredAssets(fetched, ask.place, AssetSize.Px256) : fetched, ask.frame, smoothing, fonts);
}

export function shotAnswer(id: number, shots: Shot[] | null): BuildAnswer {
  const stripped = (shots ?? []).map((s) => ({ frame: s.frame, ...stripContours(s.list.items) }));
  return { id, shots: shots && stripped.map((s, i) => ({ frame: s.frame, list: { ...shots[i].list, items: s.items } })), buffers: stripped.flatMap((s) => [s.contours.floats.buffer as ArrayBuffer, s.contours.ends.buffer as ArrayBuffer]) };
}

type Held = { key: string; frame: FrameDoc; prepared: Prepared | null };

export function playingBuilder(fonts: Fonts): (ask: Omit<BuildAsk, 'id'>) => Promise<DisplayList | null> {
  let held: Held | null = null;

  const prepareHeld = async (key: string, source: string, smoothing: Smoothing): Promise<Held> => {
    const frame = JSON.parse(source) as FrameDoc;
    if (MAIN_THREAD_ONLY.some((needs) => needs(frame))) {
      return { key, frame, prepared: null };
    }
    const faces = await fonts(frame.doc, frame.assets, frame.tokens);
    return { key, frame, prepared: prepare(frame.doc, frame.tokens, frame.assets, { fonts: faces, smoothing }) };
  };

  return async ({ source, playhead, smoothing, locals }) => {
    const key = `${smoothing}|${JSON.stringify(locals)}|${source}`;
    const now: Held = held?.key === key ? held : await prepareHeld(key, source, smoothing);
    held = now;
    return now.prepared ? drawFrame(now.prepared, frameOfLive({ ...now.frame, playhead })) : null;
  };
}

export function builtAnswer(id: number, list: DisplayList | null): BuildAnswer {
  if (!list) {
    return { id, list };
  }
  const { items, contours } = stripContours(list.items);
  return { id, list: { ...list, items }, contours };
}

export const transfers = (answer: BuildAnswer): ArrayBuffer[] => ('buffers' in answer ? answer.buffers : 'contours' in answer && answer.contours ? [answer.contours.floats.buffer as ArrayBuffer, answer.contours.ends.buffer as ArrayBuffer] : []);

type Lane = { worker: BuildWorker; busy: number };

const sourceText = ({ playhead: _playhead, ...rest }: FrameDoc): string => JSON.stringify(rest);

export type FrameBuilder = ((source: FrameDoc, smoothing: Smoothing) => Promise<DisplayList | null>) & { release: () => void; shoot: (shot: ShotOf, smoothing: Smoothing) => Promise<Shot[] | null> };

export function frameBuilder(spawn: () => BuildWorker | null, lanes = 1): FrameBuilder {
  const pool: Lane[] = [];
  let dead = false;
  let next = 0;
  const waiting = new Map<number, { lane: Lane; resolve: (answer: never) => void; reject: (e: Error) => void }>();

  const answer = (e: MessageEvent<BuildAnswer>) => {
    const asked = waiting.get(e.data.id);
    waiting.delete(e.data.id);
    if (asked) {
      asked.lane.busy--;
    }
    if ('error' in e.data) {
      asked?.reject(new Error(e.data.error));
      return;
    }
    asked?.resolve(('shots' in e.data ? e.data.shots : e.data.list) as never);
  };

  const die = () => {
    dead = true;
    for (const asked of waiting.values()) {
      asked.reject(new Error('frame worker died'));
    }
    waiting.clear();
  };

  const laneFor = (): Lane | null => {
    const idle = pool.find((l) => l.busy === 0);
    if (idle || pool.length >= lanes) {
      return idle ?? pool.reduce((a, b) => (b.busy < a.busy ? b : a));
    }
    const worker = spawn();
    if (!worker) {
      return pool[0] ?? null;
    }
    worker.onmessage = answer;
    worker.onerror = die;
    pool.push({ worker, busy: 0 });
    return pool[pool.length - 1];
  };

  const release = () => {
    for (const lane of pool.filter((l) => l.busy === 0)) {
      lane.worker.terminate?.();
      pool.splice(pool.indexOf(lane), 1);
    }
  };

  const ask = <T>(message: Omit<BuildAsk, 'id' | 'locals'>): Promise<T> => {
    const lane = dead ? null : laneFor();
    if (!lane) {
      return Promise.reject(new Error('no frame worker'));
    }
    const id = next++;
    lane.busy++;
    lane.worker.postMessage({ ...message, id, locals: localFilesSnapshot() });
    return new Promise<T>((resolve, reject) => waiting.set(id, { lane, resolve: resolve as (answer: never) => void, reject }));
  };

  const build = (source: FrameDoc, smoothing: Smoothing) => ask<DisplayList | null>({ source: sourceText(source), playhead: source.playhead, smoothing });

  const shoot = (shot: ShotOf, smoothing: Smoothing) => ask<Shot[] | null>({ source: '', smoothing, shot });

  return Object.assign(build, { release, shoot });
}
