import type { CampaignStatus } from './campaign-status';

export type CampaignActionId = 'launch' | 'reject' | 'pause' | 'resume';
export type CampaignAction = { id: CampaignActionId; label: string; spends: boolean; primary: boolean };

const LAUNCH: CampaignAction = { id: 'launch', label: 'Approve and launch', spends: true, primary: true };
const REJECT: CampaignAction = { id: 'reject', label: 'Reject', spends: false, primary: false };
const PAUSE: CampaignAction = { id: 'pause', label: 'Pause', spends: false, primary: false };
const RESUME: CampaignAction = { id: 'resume', label: 'Resume', spends: false, primary: true };

const ACTIONS_BY_STATUS: Record<CampaignStatus, CampaignAction[]> = {
  draft: [LAUNCH, REJECT],
  pending_review: [LAUNCH, REJECT],
  scheduled: [],
  active: [PAUSE],
  paused: [RESUME],
  completed: [],
  failed: [],
  rejected: []
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Proposed',
  pending_review: 'Proposed',
  scheduled: 'Launching',
  active: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected'
};

export function actionsFor(status: CampaignStatus): CampaignAction[] {
  return ACTIONS_BY_STATUS[status] ?? [];
}
