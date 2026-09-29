import { describe, expect, it } from 'vitest';
import { parsePaidAdForm, PAID_AD_FIELDS } from './paid-ad-form';

describe('parsePaidAdForm', () => {
  it('reads every field the Paid ad tab posts', () => {
    const fd = new FormData();
    fd.set(PAID_AD_FIELDS.brandId, 'b1');
    fd.set(PAID_AD_FIELDS.adAccountId, 'a1');
    fd.set(PAID_AD_FIELDS.objective, 'engagement');
    fd.set(PAID_AD_FIELDS.budgetType, 'lifetime');
    fd.set(PAID_AD_FIELDS.budgetAmount, '42.5');
    fd.set(PAID_AD_FIELDS.days, '5');
    fd.append(PAID_AD_FIELDS.country, 'it');
    fd.append(PAID_AD_FIELDS.country, 'FR');
    fd.set(PAID_AD_FIELDS.ageMin, '21');
    fd.set(PAID_AD_FIELDS.ageMax, '50');
    fd.set(PAID_AD_FIELDS.gender, 'male');
    fd.append(PAID_AD_FIELDS.placement, 'instagram_reels');
    fd.set(PAID_AD_FIELDS.primaryText, 'Body');
    fd.set(PAID_AD_FIELDS.headline, 'Head');
    fd.set(PAID_AD_FIELDS.callToAction, 'SIGN_UP');
    fd.set(PAID_AD_FIELDS.linkUrl, 'acme.test');
    fd.append(PAID_AD_FIELDS.mediaNodeId, 'n1');
    fd.set(PAID_AD_FIELDS.postId, '');

    expect(parsePaidAdForm(fd)).toEqual({
      brandId: 'b1',
      adAccountId: 'a1',
      objective: 'engagement',
      budgetType: 'lifetime',
      budgetAmount: 42.5,
      days: 5,
      countries: ['IT', 'FR'],
      ageMin: 21,
      ageMax: 50,
      gender: 'male',
      placements: ['instagram_reels'],
      primaryText: 'Body',
      headline: 'Head',
      callToAction: 'SIGN_UP',
      linkUrl: 'acme.test',
      mediaNodeIds: ['n1'],
      postId: null
    });
  });

  it('falls back to safe defaults for values outside the tables', () => {
    const fd = new FormData();
    fd.set(PAID_AD_FIELDS.objective, 'conversions');
    fd.set(PAID_AD_FIELDS.gender, 'x');
    fd.set(PAID_AD_FIELDS.callToAction, 'NOPE');
    fd.append(PAID_AD_FIELDS.placement, 'tiktok_feed');

    const draft = parsePaidAdForm(fd);
    expect(draft.objective).toBe('traffic');
    expect(draft.gender).toBe('all');
    expect(draft.callToAction).toBe('LEARN_MORE');
    expect(draft.placements).toEqual([]);
  });
});
