import type { Sandbox } from '@feega/plugin-api/host';
import { LOCKDOWN_SOURCE } from '@feega/plugin-api/lockdown';

export type WorkerLike = { postMessage: (message: unknown) => void; terminate: () => void; onmessage: ((event: { data: unknown }) => void) | null };

export type WorkerRuntime = { createWorker: (url: string) => WorkerLike; createBlobUrl: (parts: string[]) => string; revoke: (url: string) => void };

export const browserRuntime: WorkerRuntime = {
  createWorker: (url) => new Worker(url) as unknown as WorkerLike,
  createBlobUrl: (parts) => URL.createObjectURL(new Blob(parts, { type: 'text/javascript' })),
  revoke: (url) => URL.revokeObjectURL(url)
};

export const workerSandbox =
  (builtIn: Record<string, () => WorkerLike>, runtime: WorkerRuntime = browserRuntime): Sandbox =>
  (id, code) => {
    const factory = builtIn[id];
    const url = factory ? null : runtime.createBlobUrl([LOCKDOWN_SOURCE, '\n', code]);
    const worker = factory ? factory() : runtime.createWorker(url!);
    return {
      post: (message) => worker.postMessage(JSON.parse(JSON.stringify(message))),
      listen: (handle) => (worker.onmessage = (event) => handle(event.data as never)),
      close: () => (worker.terminate(), url && runtime.revoke(url))
    };
  };
