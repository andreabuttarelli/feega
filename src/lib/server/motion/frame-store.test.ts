import { describe, expect, it } from 'vitest';
import { awaitFrames, framesPrefix, putFrames, type FrameBucket } from './frame-store';

function memoryBucket(): FrameBucket & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    upload: async (path, bytes) => {
      files.set(path, Buffer.from(bytes));
      return { error: null };
    },
    list: async (prefix) => ({ data: [...files.keys()].filter((k) => k.startsWith(`${prefix}/`)).map((k) => ({ name: k.slice(prefix.length + 1) })), error: null }),
    download: async (path) => ({ data: files.has(path) ? new Blob([new Uint8Array(files.get(path)!)]) : null, error: null }),
    remove: async (paths) => {
      paths.forEach((p) => files.delete(p));
      return { error: null };
    }
  };
}

const scope = { orgId: 'o', projectId: 'p', nodeId: 'n' };
const fast = { timeoutMs: 200, pollMs: 10 };

describe('frames travel from the preview to the agent through storage', () => {
  it('frames put by the preview are read back in order, then removed', async () => {
    const bucket = memoryBucket();
    const prefix = framesPrefix(scope, 'call_1');
    setTimeout(() => void putFrames(bucket, prefix, [{ time: 2, bytes: Buffer.from([2]) }, { time: 0.5, bytes: Buffer.from([1]) }]), 20);

    const frames = await awaitFrames(bucket, prefix, 2, fast);

    expect(frames?.map((f) => f.time)).toEqual([2, 0.5]);
    expect(frames?.[1].bytes).toEqual(Buffer.from([1]));
    expect(bucket.files.size).toBe(0);
  });

  it('no preview answering within the timeout is null, not a hang', async () => {
    expect(await awaitFrames(memoryBucket(), framesPrefix(scope, 'call_2'), 1, fast)).toBeNull();
  });

  it('the path lives under the org and project, like every canvas asset', () => {
    expect(framesPrefix(scope, 'call_1')).toBe('o/p/motion-frames/n/call_1');
  });
});
