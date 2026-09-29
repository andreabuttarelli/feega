export const CAMPAIGN_STATUSES = [
  'draft',
  'pending_review',
  'scheduled',
  'active',
  'paused',
  'completed',
  'failed',
  'rejected'
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
