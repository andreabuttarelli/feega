import type { MotionDoc } from '$lib/motion/doc';
import { elementName } from '$lib/motion/element-name';
import { pxRead } from '$lib/motion/px-fields';
import type { CanvasNodeRecord, Connection } from '$lib/server/repos/canvas';

type RunLike = { status: string };

export type SummaryInput = { canvasId: string; nodes: CanvasNodeRecord[]; connections: Connection[]; runs: Record<string, RunLike[]>; docs: Map<string, MotionDoc> };

type Clip = MotionDoc['tracks'][number]['clips'][number];

const textOf = (props: Record<string, unknown>) => (typeof props.text === 'string' ? props.text : null);

const elementOf = (clip: Clip, doc: MotionDoc) => {
  const props = clip.props as Record<string, unknown>;
  return {
    id: clip.id,
    kind: clip.component,
    name: elementName(clip as never),
    bounds: pxRead(props, { width: doc.width, height: doc.height }).box,
    text: textOf(props),
    start: clip.from / doc.fps,
    duration: clip.durationInFrames / doc.fps
  };
};

export const elementsOf = (doc: MotionDoc) => doc.tracks.flatMap((track) => track.clips.map((clip) => elementOf(clip, doc)));

export function detailOf(doc: MotionDoc, elementId: string) {
  const clip = doc.tracks.flatMap((t) => t.clips).find((c) => c.id === elementId);
  return clip ? { ...elementOf(clip, doc), component: clip.component, props: clip.props, transform: clip.transform, keyframes: clip.keyframes } : null;
}

const lastStatus = (runs: RunLike[] | undefined) => runs?.at(-1)?.status ?? null;

export function summarizeCanvas(input: SummaryInput) {
  const nodes = input.nodes.map((node) => {
    const doc = input.docs.get(node.id);
    return {
      id: node.id,
      type: node.type,
      title: node.displayName,
      x: node.position.x,
      y: node.position.y,
      width: node.size.width,
      height: node.size.height,
      run: lastStatus(input.runs[node.id]),
      inputs: input.connections.filter((c) => c.targetNodeId === node.id).map((c) => c.sourceNodeId),
      outputs: input.connections.filter((c) => c.sourceNodeId === node.id).map((c) => c.targetNodeId),
      ...(doc ? { frame: { width: doc.width, height: doc.height }, elements: elementsOf(doc) } : {})
    };
  });
  return { canvas_id: input.canvasId, nodes, connections: input.connections.map((c) => ({ id: c.id, from: c.sourceNodeId, to: c.targetNodeId })) };
}
