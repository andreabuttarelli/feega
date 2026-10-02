import type { PurgeOutcome } from './provider-purge';

export type WiroModelRef = { owner: string; project: string };

export type WiroOutput = { url: string; contentType: string };

export type WiroTask =
  | { state: 'pending' }
  | { state: 'done'; outputs: WiroOutput[]; costUsd: number }
  | { state: 'failed'; error: string };

export type WiroGateway = {
  run(model: WiroModelRef, inputs: Record<string, unknown>): Promise<{ taskId: string }>;
  task(taskId: string): Promise<WiroTask>;
  purge(taskId: string): Promise<PurgeOutcome>;
};
