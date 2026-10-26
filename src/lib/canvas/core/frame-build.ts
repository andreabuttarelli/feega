import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare, type DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';
import { readClips } from '@feega/motion-core/motion/gpu-full/dom/custom';
import type { FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import type { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { sceneNodeIds } from '$lib/motion/scenes';
import { frameOfLive } from './frame-source';

export type FrameDoc = { revision: number; doc: MotionDoc; assets: Record<string, string>; tokens: BrandTokens; playhead?: number };

export type Fonts = (doc: MotionDoc, assets: Record<string, string>, tokens: BrandTokens) => Promise<FaceBook>;

export type BuildAsk = { id: number; url: string; smoothing: Smoothing };

export type BuildAnswer = { id: number; list: DisplayList | null } | { id: number; error: string };

export type BuildWorker = { postMessage: (ask: BuildAsk) => void; onmessage: ((e: MessageEvent<BuildAnswer>) => void) | null; onerror: ((e: ErrorEvent) => void) | null };

const MAIN_THREAD_ONLY: ((doc: MotionDoc) => boolean)[] = [(doc) => readClips(doc).read.length > 0, (doc) => sceneNodeIds(doc).length > 0];

export async function buildFrame(source: FrameDoc, smoothing: Smoothing, fonts: Fonts): Promise<DisplayList | null> {
  if (MAIN_THREAD_ONLY.some((needs) => needs(source.doc))) {
    return null;
  }
  const faces = await fonts(source.doc, source.assets, source.tokens);
  const prepared = prepare(source.doc, source.tokens, source.assets, { fonts: faces, smoothing });
  return drawFrame(prepared, frameOfLive(source));
}

export function frameBuilder(spawn: () => BuildWorker | null): (url: string, smoothing: Smoothing) => Promise<DisplayList | null> {
  let worker: BuildWorker | null = null;
  let dead = false;
  let next = 0;
  const waiting = new Map<number, { resolve: (list: DisplayList | null) => void; reject: (e: Error) => void }>();

  const answer = (e: MessageEvent<BuildAnswer>) => {
    const asked = waiting.get(e.data.id);
    waiting.delete(e.data.id);
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

  return (url, smoothing) => {
    worker = dead ? null : (worker ?? spawn());
    if (!worker) {
      return Promise.reject(new Error('no frame worker'));
    }
    worker.onmessage = answer;
    worker.onerror = die;
    const id = next++;
    worker.postMessage({ id, url, smoothing });
    return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
  };
}
