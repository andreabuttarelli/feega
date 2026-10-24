import type { MotionDoc } from '$lib/motion/doc';
import { resolveScenes, sceneNodeIds } from '$lib/motion/scenes';

export type SceneSource = { doc: MotionDoc; assets: Record<string, string> };
export type LoadScene = (nodeId: string) => Promise<SceneSource | null>;

const uniqueScenes = (doc: MotionDoc) => [...new Set(sceneNodeIds(doc))];

export type LoadedScenes = { docs: Record<string, MotionDoc>; assets: Record<string, string> };

export async function loadScenes(doc: MotionDoc, load: LoadScene): Promise<LoadedScenes> {
  const loaded = await Promise.all(uniqueScenes(doc).map(async (id) => [id, await load(id).catch(() => null)] as const));
  const found = loaded.flatMap(([id, s]) => (s ? [[id, s] as const] : []));
  return { docs: Object.fromEntries(found.map(([id, s]) => [id, s.doc])), assets: Object.assign({}, ...found.map(([, s]) => s.assets)) };
}

export async function withScenes<T extends SceneSource>(source: T, load: LoadScene): Promise<T> {
  if (!uniqueScenes(source.doc).length) {
    return source;
  }
  const scenes = await loadScenes(source.doc, load);
  return { ...source, doc: resolveScenes(source.doc, scenes.docs), assets: { ...scenes.assets, ...source.assets } };
}

export function sceneStamp(doc: MotionDoc, revisionOf: (nodeId: string) => number): string {
  return uniqueScenes(doc)
    .map((id) => `${id}@${revisionOf(id)}`)
    .join(',');
}
