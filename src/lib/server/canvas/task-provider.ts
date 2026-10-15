import type { PurgeOutcome } from './provider-purge';

export type TaskWireRef = { owner: string; project: string };

export type TaskOutput = { url: string; contentType: string };

export type TaskState =
  | { state: 'pending' }
  | { state: 'done'; outputs: TaskOutput[]; costUsd: number }
  | { state: 'failed'; error: string };

export type TaskProvider = {
  run(model: TaskWireRef, inputs: Record<string, unknown>): Promise<{ taskId: string }>;
  task(taskId: string): Promise<TaskState>;
  purge(taskId: string): Promise<PurgeOutcome>;
};
