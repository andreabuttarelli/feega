import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import type { Flow } from '@feega/motion-core/motion/prototype/flow';

export type FlowStart = { frame: string; name: Flow['name'] };

export function setFlow(doc: MotionDoc, name: string | null): OpResult {
  if (name === null) {
    const { flow: _gone, ...rest } = doc;
    return { ok: true, doc: rest };
  }
  const trimmed = name.trim();
  return trimmed ? { ok: true, doc: { ...doc, flow: { name: trimmed } } } : { ok: false, error: 'a flow needs a name' };
}

export function flowsOf(docs: ReadonlyMap<string, MotionDoc>, order: readonly string[]): FlowStart[] {
  return order.flatMap((frame) => {
    const flow = docs.get(frame)?.flow;
    return flow ? [{ frame, name: flow.name }] : [];
  });
}

export function startFrame(docs: ReadonlyMap<string, MotionDoc>, order: readonly string[], asked: string | null): string | null {
  if (asked && docs.has(asked)) {
    return asked;
  }
  return flowsOf(docs, order)[0]?.frame ?? order.find((id) => docs.has(id)) ?? null;
}
