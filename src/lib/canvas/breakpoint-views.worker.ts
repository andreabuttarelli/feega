import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';

type Ask = { id: number; doc: MotionDoc; breakpointIds: string[] };

self.onmessage = (e: MessageEvent<Ask>) => {
  const { id, doc, breakpointIds } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, docs: breakpointIds.map((bp) => resolveView(doc, bp)) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
