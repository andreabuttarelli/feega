import { stepCountIs } from 'ai';

const MS_PER_S = 1000;
const STOP_MARGIN_MS = 30_000;
const SELF_SAVE_MARGIN_MS = 25_000;
const REAP_GRACE_MS = 60_000;

function deadlineReached(startedAt: number, deadlineMs: number): boolean {
  return Date.now() - startedAt >= deadlineMs;
}

export const AGENT_MAX_DURATION_S = 1800;

export const AGENT_MAX_STEPS = 240;

export const AGENT_DEADLINE_MS = AGENT_MAX_DURATION_S * MS_PER_S - STOP_MARGIN_MS;

export const AGENT_SELF_SAVE_MS = AGENT_MAX_DURATION_S * MS_PER_S - SELF_SAVE_MARGIN_MS;

export const AGENT_STALE_MS = AGENT_MAX_DURATION_S * MS_PER_S + REAP_GRACE_MS;

export const AGENT_TURN_CAP_USD = 1.5;

type StepsSoFar = { steps: unknown[] };

export function agentStopWhen(startedAt: number): (input: StepsSoFar) => boolean {
  const byCount = stepCountIs(AGENT_MAX_STEPS);

  return (input: StepsSoFar) =>
    deadlineReached(startedAt, AGENT_DEADLINE_MS) || !!byCount(input as never);
}

export function overTurnCap(spentUsd: () => number): (input: StepsSoFar) => boolean {
  return () => spentUsd() > AGENT_TURN_CAP_USD;
}
