import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare, type DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';
import { readClips } from '@feega/motion-core/motion/gpu-full/dom/custom';
import { stripContours, type ContourView } from '@feega/motion-core/motion/gpu-full/wire';
import { localFilesSnapshot, type LocalFilesSnapshot } from '@feega/motion-core/motion/fonts/local-files';
import type { FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import type { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { sceneNodeIds } from '$lib/motion/scenes';
import { frameOfLive } from './frame-source';

export type FrameDoc = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens; playhead?: number };

export type Fonts = (doc: MotionDoc, assets: Record<string, string>, tokens: BrandTokens) => Promise<FaceBook>;

export type BuildAsk = { id: number; source: string; smoothing: Smoothing; locals: LocalFilesSnapshot };

export type BuildAnswer = { id: number; list: DisplayList | null; contours?: ContourView } | { id: number; error: string };

export type BuildWorker = { postMessage: (ask: BuildAsk) => void; onmessage: ((e: MessageEvent<BuildAnswer>) => void) | null; onerror: ((e: ErrorEvent) => void) | null };

const MAIN_THREAD_ONLY: ((source: FrameDoc) => boolean)[] = [(source) => readClips(source.doc, source.tokens.logoUrl).read.length > 0, (source) => sceneNodeIds(source.doc).length > 0];

export async function buildFrame(source: FrameDoc, smoothing: Smoothing, fonts: Fonts): Promise<DisplayList | null> {
  if (MAIN_THREAD_ONLY.some((needs) => needs(source))) {
    return null;
  }
  const faces = await fonts(source.doc, source.assets, source.tokens);
  const prepared = prepare(source.doc, source.tokens, source.assets, { fonts: faces, smoothing });
  return drawFrame(prepared, frameOfLive(source));
}

export function builtAnswer(id: number, list: DisplayList | null): BuildAnswer {
  if (!list) {
    return { id, list };
  }
  const { items, contours } = stripContours(list.items);
  return { id, list: { ...list, items }, contours };
}

export const transfers = (answer: BuildAnswer): ArrayBuffer[] => ('contours' in answer && answer.contours ? [answer.contours.floats.buffer as ArrayBuffer, answer.contours.ends.buffer as ArrayBuffer] : []);

type Lane = { worker: BuildWorker; busy: number };

const docTexts = new WeakMap<MotionDoc, string>();

function sourceText({ doc, ...rest }: FrameDoc): string {
  const text = docTexts.get(doc) ?? JSON.stringify(doc);
  docTexts.set(doc, text);
  return `{"doc":${text},${JSON.stringify(rest).slice(1)}`;
}

export function frameBuilder(spawn: () => BuildWorker | null, lanes = 1): (source: FrameDoc, smoothing: Smoothing) => Promise<DisplayList | null> {
  const pool: Lane[] = [];
  let dead = false;
  let next = 0;
  const waiting = new Map<number, { lane: Lane; resolve: (list: DisplayList | null) => void; reject: (e: Error) => void }>();

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
    asked?.resolve(e.data.list);
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

  return (source, smoothing) => {
    const lane = dead ? null : laneFor();
    if (!lane) {
      return Promise.reject(new Error('no frame worker'));
    }
    const id = next++;
    lane.busy++;
    lane.worker.postMessage({ id, source: sourceText(source), smoothing, locals: localFilesSnapshot() });
    return new Promise((resolve, reject) => waiting.set(id, { lane, resolve, reject }));
  };
}
