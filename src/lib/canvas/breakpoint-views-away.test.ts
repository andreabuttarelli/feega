import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { resolveView } from '@feega/motion-core/motion/breakpoints/view';
import { viewsAway, type ViewsWorker } from './breakpoint-views-away';
import { resolvedViewDocs } from './breakpoint-views';

const inProcess = (): ViewsWorker => {
  const worker: ViewsWorker = {
    onmessage: null,
    terminate: () => {},
    postMessage: ({ id, doc, breakpointIds }) => {
      const copy = structuredClone(doc) as MotionDoc;
      queueMicrotask(() => worker.onmessage?.({ data: { id, docs: breakpointIds.map((bp) => resolveView(copy, bp)) } } as MessageEvent));
    }
  };
  return worker;
};

describe('breakpoint views resolved in a worker', () => {
  const page: MotionDoc = { ...landingDoc(), breakpoints: [{ id: 'ph', name: 'Phone', width: 390 }, { id: 'tab', name: 'Tablet', width: 810 }] };

  it('answers the same docs as the main thread', async () => {
    const docs = await viewsAway(inProcess)(page, ['tab', 'ph']);
    expect(docs).toEqual(resolvedViewDocs(page, ['tab', 'ph']));
  });

  it('fails so the caller can fall back when no worker can start', async () => {
    await expect(viewsAway(() => null)(page, ['ph'])).rejects.toThrow();
  });
});
