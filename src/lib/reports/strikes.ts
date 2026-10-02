import { ReportReason } from './reasons';

export enum Standing {
  Good = 'good',
  Warned = 'warned',
  Suspended = 'suspended',
  Terminated = 'terminated'
}

const STRIKE_WEIGHT: Record<ReportReason, number> = {
  [ReportReason.Copyright]: 1,
  [ReportReason.Illegal]: 1,
  [ReportReason.Likeness]: 2,
  [ReportReason.Csam]: 3
};

const THRESHOLDS: readonly { from: number; standing: Standing }[] = [
  { from: 3, standing: Standing.Terminated },
  { from: 2, standing: Standing.Suspended },
  { from: 1, standing: Standing.Warned },
  { from: 0, standing: Standing.Good }
];

export const SUSPENSION_DAYS = 30;

export function strikeWeight(reason: ReportReason): number {
  return STRIKE_WEIGHT[reason];
}

export function standingFor(total: number): Standing {
  return THRESHOLDS.find((t) => total >= t.from)!.standing;
}
