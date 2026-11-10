export type Call = { name: string; args: unknown[] };

export enum ToWorker {
  Attach = 'attach',
  Calls = 'calls',
  Poster = 'poster',
  Free = 'free'
}

export enum FromWorker {
  Attached = 'attached',
  Failed = 'failed',
  Framed = 'framed',
  Poster = 'poster'
}

export type Stats = { outcome: string; pending: boolean; cacheBytes: number; pictureBytes: number; scratchBytes: number; wasmBytes: number; lost: boolean; busy: boolean };

export type WorkerIn =
  | { kind: ToWorker.Attach; canvas?: OffscreenCanvas; width: number; height: number }
  | { kind: ToWorker.Calls; calls: Call[]; frames: number }
  | { kind: ToWorker.Poster; id: number; group: string; width: number; height: number; scale: number }
  | { kind: ToWorker.Free };

export type WorkerOut =
  | { kind: FromWorker.Attached }
  | { kind: FromWorker.Failed; why: string }
  | { kind: FromWorker.Framed; frames: number; stats: Stats; at: number }
  | { kind: FromWorker.Poster; id: number; bytes: Uint8Array | null };
