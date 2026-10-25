import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { sceneNodeIds } from '$lib/motion/scenes';
import type { FrameTarget } from './canvas-drop';

export type SceneDrop = { targetId: string; sourceId: string; at: number };

export type DocOf = (nodeId: string) => MotionDoc | null;

const isSequence = (doc: MotionDoc | null) => doc !== null && sceneNodeIds(doc).length > 0;

export function sceneDrop(ids: readonly string[], docOf: DocOf, under: FrameTarget | null): SceneDrop | null {
  const [sourceId] = ids;
  if (ids.length !== 1 || !under || under.frameId === sourceId) {
    return null;
  }
  const source = docOf(sourceId);
  if (!source || isSequence(source) || !isSequence(docOf(under.frameId))) {
    return null;
  }
  return { targetId: under.frameId, sourceId, at: under.at.x };
}
