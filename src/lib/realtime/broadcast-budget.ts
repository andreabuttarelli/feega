export enum Plan {
  Free = 'free',
  Pro = 'pro',
  ProNoCap = 'pro-no-cap',
  Team = 'team'
}

export type PlanLimits = { messagesPerSecond: number; connections: number; presencePerSecond: number; payloadKb: number };

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.Free]: { messagesPerSecond: 100, connections: 200, presencePerSecond: 20, payloadKb: 256 },
  [Plan.Pro]: { messagesPerSecond: 500, connections: 500, presencePerSecond: 50, payloadKb: 3000 },
  [Plan.ProNoCap]: { messagesPerSecond: 2500, connections: 10_000, presencePerSecond: 1000, payloadKb: 3000 },
  [Plan.Team]: { messagesPerSecond: 2500, connections: 10_000, presencePerSecond: 1000, payloadKb: 3000 }
};

export type Load = { peers: number; hz: number; draggers: number; dragHz: number };

export type Budget = { sent: number; received: number };

export function budgetOf(load: Load): Budget {
  const sent = load.peers * load.hz + load.draggers * load.dragHz;
  return { sent, received: sent * Math.max(0, load.peers - 1) };
}

export function fitsPlan(budget: Budget, plan: Plan): boolean {
  return budget.received + budget.sent <= PLAN_LIMITS[plan].messagesPerSecond;
}

export const MAX_HZ = 20;
const MIN_HZ = 0.2;
const HZ_STEP = 10;

export function hzFor(peers: number, plan: Plan): number {
  const crowd = Math.max(1, peers) ** 2;
  return Math.max(MIN_HZ, Math.min(MAX_HZ, Math.floor((HZ_STEP * PLAN_LIMITS[plan].messagesPerSecond) / crowd) / HZ_STEP));
}
