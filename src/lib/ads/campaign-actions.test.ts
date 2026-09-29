import { describe, expect, it } from 'vitest';
import { actionsFor, STATUS_LABELS } from './campaign-actions';
import { CAMPAIGN_STATUSES } from '$lib/ads/campaign-status';

describe('actionsFor', () => {
  it.each([
    ['draft', ['launch', 'reject']],
    ['pending_review', ['launch', 'reject']],
    ['active', ['pause']],
    ['paused', ['resume']],
    ['scheduled', []],
    ['failed', []],
    ['rejected', []],
    ['completed', []]
  ] as const)('%s → %o', (status, ids) => {
    expect(actionsFor(status).map((a) => a.id)).toEqual(ids);
  });

  it('only launch spends money', () => {
    const spending = CAMPAIGN_STATUSES.flatMap((s) => actionsFor(s)).filter((a) => a.spends);
    expect(new Set(spending.map((a) => a.id))).toEqual(new Set(['launch']));
  });

  it('every status has a label', () => {
    for (const status of CAMPAIGN_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
