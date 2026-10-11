import { describe, expect, it } from 'vitest';
import { OPENROUTER_UPSCALE_MODEL } from '$lib/video-models';
import { jobsOf, UpscaleJobStatus } from './job';

const node = (id: string, y: number, data: Record<string, unknown>) => ({
  id,
  canvasId: 'c-up',
  projectId: 'p1',
  type: 'video',
  displayName: null,
  position: { x: 0, y, z: 0 },
  size: { width: null, height: null },
  data,
  version: 1
});

const nodes = [
  node('src-a', 0, { assetId: 'a' }),
  node('up-a', 0, { model: OPENROUTER_UPSCALE_MODEL, refId: 'out-a', params: { upscale_factor: 2 } }),
  node('src-b', 400, { assetId: 'b' }),
  node('up-b', 400, { model: OPENROUTER_UPSCALE_MODEL, running: true, params: { upscale_factor: 4 } }),
  node('other', 800, { model: 'some-other-model' })
];
const connections = [
  { id: 'e1', canvasId: 'c-up', sourceNodeId: 'src-a', targetNodeId: 'up-a', sourceHandle: null, targetHandle: null, mode: 'fixed' as const },
  { id: 'e2', canvasId: 'c-up', sourceNodeId: 'src-b', targetNodeId: 'up-b', sourceHandle: null, targetHandle: null, mode: 'fixed' as const }
];

describe('jobsOf lists the upscales on a canvas, newest first', () => {
  it('keeps only upscale nodes, the lowest row first', () => {
    expect(jobsOf(nodes, connections, 10).map((j) => j.nodeId)).toEqual(['up-b', 'up-a']);
  });

  it('pairs each job with its source and output', () => {
    const [running, done] = jobsOf(nodes, connections, 10);
    expect(running).toMatchObject({ status: UpscaleJobStatus.Running, factor: 4, beforeUrl: '/p/p1/c/c-up/assets/b', afterUrl: null });
    expect(done).toMatchObject({ status: UpscaleJobStatus.Done, factor: 2, afterUrl: '/p/p1/c/c-up/assets/out-a' });
  });

  it('stops at the limit', () => {
    expect(jobsOf(nodes, connections, 1)).toHaveLength(1);
  });
});
