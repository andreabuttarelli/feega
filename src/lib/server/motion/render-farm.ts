export const FARM_RUNTIME_DIR = '/vercel/r';
export const FARM_JOB_DIR = '/vercel/sandbox/job';

export type FarmFile = { path: string; content: Buffer };
export type FarmRun = { exitCode: number; output: string };
export enum Network {
  Listed = 'listed',
  Open = 'open'
}

export type WorkerSpec = { allowHosts: string[]; timeoutMs: number; vcpus: number; network?: Network };
export type LiveWorker = { name: string; createdAt: number };
import type { WorkerUsage } from '$lib/motion/render-quote';
export type { WorkerUsage };

export type FarmWorker = {
  name: string;
  write: (files: FarmFile[]) => Promise<void>;
  run: (cmd: string, args: string[]) => Promise<FarmRun>;
  spawn: (cmd: string, args: string[]) => Promise<void>;
  read: (path: string) => Promise<Buffer | null>;
  stop: () => Promise<void>;
};

export type RenderFarm = {
  open: (spec: WorkerSpec) => Promise<FarmWorker>;
  attach: (name: string) => Promise<FarmWorker | null>;
  running: () => Promise<LiveWorker[]>;
  usage: (name: string) => Promise<WorkerUsage | null>;
};
