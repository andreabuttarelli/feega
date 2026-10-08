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
const VERDICT_NAME = 'verdict.json';

export type StoredVerdict = { ok: boolean; problems: string[] };

export const framePaths = (prefix: string, frames: readonly { time: number }[]) => frames.map((f, i) => `${prefix}/${nameOf(i, f.time)}`);

export async function putFrames(bucket: FrameBucket, prefix: string, frames: Frame[]): Promise<boolean> {
  const paths = framePaths(prefix, frames);
  const results = await Promise.all(frames.map((f, i) => bucket.upload(paths[i], f.bytes, { contentType: 'image/jpeg', upsert: true })));
  return results.every((r) => !r.error);
}

async function listed(bucket: FrameBucket, prefix: string): Promise<string[]> {
  const { data, error } = await bucket.list(prefix);
  if (error) {
    throw new Error(`frame storage refused the read: ${error.message}`);
  }
  return (data ?? []).map((f) => f.name);
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
    const names = (await listed(bucket, prefix)).filter((n) => FRAME_NAME.test(n));
    if (names.length >= count) {
      return readAll(bucket, prefix, names);
    }
    await new Promise((r) => setTimeout(r, timing.pollMs));
  }
  return null;
}

export async function putVerdict(bucket: FrameBucket, prefix: string, verdict: StoredVerdict): Promise<boolean> {
  const { error } = await bucket.upload(`${prefix}/${VERDICT_NAME}`, Buffer.from(JSON.stringify(verdict)), { contentType: 'application/json', upsert: true });
  return !error;
}

export async function awaitVerdict(bucket: FrameBucket, prefix: string, timing = { timeoutMs: FRAME_WAIT_MS, pollMs: FRAME_POLL_MS }): Promise<(StoredVerdict & { frames: Frame[] }) | null> {
  const deadline = Date.now() + timing.timeoutMs;
  while (Date.now() < deadline) {
    const names = await listed(bucket, prefix);
    if (names.includes(VERDICT_NAME)) {
      const { data: blob } = await bucket.download(`${prefix}/${VERDICT_NAME}`);
      const verdict = JSON.parse(blob ? await blob.text() : '{}') as StoredVerdict;
      const frames = await readAll(bucket, prefix, names.filter((n) => FRAME_NAME.test(n)));
      await bucket.remove([`${prefix}/${VERDICT_NAME}`]);
      return { ok: verdict.ok === true, problems: verdict.problems ?? [], frames };
    }
    await new Promise((r) => setTimeout(r, timing.pollMs));
  }
  return null;
}
