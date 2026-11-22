import { describe, expect, it, vi } from 'vitest';
import { LOCKDOWN_SOURCE } from '@feega/plugin-api/lockdown';
import { workerSandbox, type WorkerLike, type WorkerRuntime } from './worker-sandbox';

function fakeWorker(): WorkerLike & { posted: unknown[]; terminated: boolean; emit: (data: unknown) => void } {
  const worker = {
    posted: [] as unknown[],
    terminated: false,
    onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage(message: unknown) {
      this.posted.push(structuredClone(message));
    },
    terminate() {
      this.terminated = true;
    },
    emit(data: unknown) {
      this.onmessage?.({ data });
    }
  };
  return worker;
}

describe('workerSandbox', () => {
  it('starts a built-in plugin from its own factory', () => {
    const worker = fakeWorker();
    const factory = vi.fn(() => worker);
    const channel = workerSandbox({ 'feega.mesh': factory }, {} as WorkerRuntime)('feega.mesh', '');
    channel.post({ type: 'signal', signal: 'command' as never, payload: {} });
    expect(factory).toHaveBeenCalledOnce();
    expect(worker.posted).toHaveLength(1);
  });

  it('sends reactive proxies as plain data, which a worker can clone', () => {
    const worker = fakeWorker();
    const channel = workerSandbox({ a: () => worker }, {} as WorkerRuntime)('a', '');
    const selection = new Proxy({ source: new Proxy({ file: 'a.svelte' }, {}) }, {});
    channel.post({ type: 'signal', signal: 'selection' as never, payload: { selection } });
    expect(worker.posted).toEqual([{ type: 'signal', signal: 'selection', payload: { selection: { source: { file: 'a.svelte' } } } }]);
  });

  it('passes what the plugin posts to the listener', () => {
    const worker = fakeWorker();
    const channel = workerSandbox({ a: () => worker }, {} as WorkerRuntime)('a', '');
    const heard: unknown[] = [];
    channel.listen((m) => heard.push(m));
    worker.emit({ type: 'call', id: 1, call: 'selection' });
    expect(heard).toEqual([{ type: 'call', id: 1, call: 'selection' }]);
  });

  it('terminates the worker on close', () => {
    const worker = fakeWorker();
    workerSandbox({ a: () => worker }, {} as WorkerRuntime)('a', '').close();
    expect(worker.terminated).toBe(true);
  });

  it('runs third-party code in a blob worker with the lockdown first', () => {
    const worker = fakeWorker();
    const blobs: { parts: string[] }[] = [];
    const runtime: WorkerRuntime = {
      createWorker: vi.fn(() => worker),
      createBlobUrl: (parts) => (blobs.push({ parts }), 'blob:plugin'),
      revoke: vi.fn()
    };
    const channel = workerSandbox({}, runtime)('acme.x', 'self.postMessage(1)');
    expect(blobs[0].parts).toEqual([LOCKDOWN_SOURCE, '\n', 'self.postMessage(1)']);
    expect(runtime.createWorker).toHaveBeenCalledWith('blob:plugin');
    expect(runtime.revoke).not.toHaveBeenCalled();
    channel.close();
    expect(runtime.revoke).toHaveBeenCalledWith('blob:plugin');
    expect(worker.terminated).toBe(true);
  });
});
