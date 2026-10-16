import type { PurgeOutcome } from './provider-purge';

export type WireFields = {
  prompt?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: string;
  images: string[];
  imageList?: string;
  video?: string;
  videoList?: string;
  audioList?: string;
  lastFrame?: string;
};

export type TaskWireRef = Readonly<Record<string, unknown>>;

export type TaskOutput = { url: string; contentType: string };

export type TaskState =
  | { state: 'pending' }
  | { state: 'done'; outputs: TaskOutput[]; costUsd: number | null }
  | { state: 'failed'; error: string };

export type TaskProvider = {
  run(model: TaskWireRef, inputs: Record<string, unknown>, idempotencyKey?: string): Promise<{ taskId: string }>;
  task(taskId: string): Promise<TaskState>;
  purge?(taskId: string): Promise<PurgeOutcome>;
  cancel?(taskId: string): Promise<boolean>;
};
