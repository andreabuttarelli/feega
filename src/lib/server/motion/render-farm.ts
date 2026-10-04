export const FARM_RUNTIME_DIR = '/vercel/r';
export const FARM_JOB_DIR = '/vercel/sandbox/job';

export type FarmFile = { path: string; content: Buffer };
export type FarmRun = { exitCode: number; output: string };
export type WorkerSpec = { allowHosts: string[]; timeoutMs: number; vcpus: number };

export type FarmWorker = {
  write: (files: FarmFile[]) => Promise<void>;
  run: (cmd: string, args: string[]) => Promise<FarmRun>;
  read: (path: string) => Promise<Buffer | null>;
  stop: () => Promise<void>;
};

export type RenderFarm = {
  open: (spec: WorkerSpec) => Promise<FarmWorker>;
};
