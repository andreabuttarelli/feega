import type { Frame } from './frames';

export const FRAME_WAIT_MS = 25_000;
export const FRAME_POLL_MS = 400;

type StorageError = { message: string } | null;

export type FrameBucket = {
  upload: (path: string, bytes: Buffer, options?: { contentType: string; upsert: boolean }) => Promise<{ error: StorageError }>;
  list: (prefix: string) => Promise<{ data: { name: string }[] | null; error: StorageError }>;
  download: (path: string) => Promise<{ data: Blob | null; error: StorageError }>;
  remove: (paths: string[]) => Promise<{ error: StorageError }>;
};

export type FrameScope = { orgId: string; projectId: string; nodeId: string };

export function framesPrefix(scope: FrameScope, callId: string): string {
  return `${scope.orgId}/${scope.projectId}/motion-frames/${scope.nodeId}/${callId}`;
}

const nameOf = (index: number, time: number) => `${index}_${time}.jpg`;
const FRAME_NAME = /^(\d+)_([\d.]+)\.jpg$/;

export async function putFrames(bucket: FrameBucket, prefix: string, frames: Frame[]): Promise<boolean> {
  const results = await Promise.all(frames.map((f, i) => bucket.upload(`${prefix}/${nameOf(i, f.time)}`, f.bytes, { contentType: 'image/jpeg', upsert: true })));
  return results.every((r) => !r.error);
}

async function readAll(bucket: FrameBucket, prefix: string, names: string[]): Promise<Frame[]> {
  const parsed = names.map((name) => ({ name, match: FRAME_NAME.exec(name) })).filter((n) => n.match);
  parsed.sort((a, b) => Number(a.match![1]) - Number(b.match![1]));
  const frames = await Promise.all(
    parsed.map(async ({ name, match }) => {
      const { data } = await bucket.download(`${prefix}/${name}`);
      const frame: Frame | null = data ? { time: Number(match![2]), bytes: Buffer.from(await data.arrayBuffer()) } : null;
      return frame;
    })
  );
  await bucket.remove(names.map((n) => `${prefix}/${n}`));
  return frames.filter((f): f is Frame => f !== null);
}

export async function awaitFrames(bucket: FrameBucket, prefix: string, count: number, timing = { timeoutMs: FRAME_WAIT_MS, pollMs: FRAME_POLL_MS }): Promise<Frame[] | null> {
  const deadline = Date.now() + timing.timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await bucket.list(prefix);
    const names = (data ?? []).map((f) => f.name).filter((n) => FRAME_NAME.test(n));
    if (names.length >= count) {
      return readAll(bucket, prefix, names);
    }
    await new Promise((r) => setTimeout(r, timing.pollMs));
  }
  return null;
}
