import type { UIMessageChunk } from 'ai';
import { finishedTurn } from '$lib/server/project-agent/finished-turn';
import { AGENT_SELF_SAVE_MS, agentStopWhen } from '$lib/server/project-agent/limits';

export enum Client {
  Watching = 'watching',
  Gone = 'gone'
}

export type Stop = ReturnType<typeof agentStopWhen>;

export const CLOSING_RESERVE_MS = 60_000;

export type TurnTiming = { landingMs: number; stopPollMs: number };

export const PLATFORM_TIMING: TurnTiming = { landingMs: AGENT_SELF_SAVE_MS, stopPollMs: 3000 };

export const oneStep: Stop = ({ steps }) => steps.length >= 1;

export type TurnStep = Parameters<typeof finishedTurn>[0][number] & { usage: unknown; finishReason: string };

export const closedByModel = (last: TurnStep | undefined) => last?.finishReason === 'stop' && last.text.trim().length > 0;

export function writeText(writer: { write: (chunk: UIMessageChunk) => void }, id: string, text: string): void {
  writer.write({ type: 'text-start', id });
  writer.write({ type: 'text-delta', id, delta: text });
  writer.write({ type: 'text-end', id });
}
