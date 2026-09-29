import { describe, expect, it } from 'vitest';
import {
  draftProblems,
  placementsPayload,
  scheduleFor,
  totalBudget,
  launchFee,
  type PaidAdDraft
} from './paid-ad';

const draft: PaidAdDraft = {
  brandId: 'b1',
  adAccountId: 'acct-1',
  objective: 'traffic',
  budgetType: 'daily',
  budgetAmount: 10,
  days: 7,
  countries: ['IT'],
  ageMin: 18,
  ageMax: 65,
  gender: 'all',
  placements: ['facebook_feed', 'instagram_feed'],
  primaryText: 'New drop',
  headline: 'Shop the drop',
  callToAction: 'SHOP_NOW',
  linkUrl: 'https://acme.test',
  mediaNodeIds: ['n1'],
  postId: null
};

describe('draftProblems', () => {
  it('a complete draft has none', () => {
    expect(draftProblems(draft)).toEqual([]);
  });

  it.each([
    [{ adAccountId: '' }, 'adAccountId'],
    [{ budgetAmount: 0 }, 'budgetAmount'],
    [{ days: 0 }, 'days'],
    [{ countries: [] }, 'countries'],
    [{ ageMin: 40, ageMax: 30 }, 'age'],
    [{ placements: [] }, 'placements'],
    [{ primaryText: ' ' }, 'primaryText'],
    [{ headline: '' }, 'headline'],
    [{ linkUrl: '' }, 'linkUrl'],
    [{ mediaNodeIds: [] }, 'media']
  ] as const)('%o is refused on %s', (patch, field) => {
    expect(draftProblems({ ...draft, ...(patch as Partial<PaidAdDraft>) }).map((p) => p.field)).toContain(field);
  });

  it('awareness needs no link', () => {
    expect(draftProblems({ ...draft, objective: 'awareness', linkUrl: '' })).toEqual([]);
  });

  it('a boost of a published post needs no media from the canvas', () => {
    expect(draftProblems({ ...draft, mediaNodeIds: [], postId: 'p1' })).toEqual([]);
  });
});

describe('budget and fee', () => {
  it('a daily budget runs for every day of the duration', () => {
    expect(totalBudget(draft)).toBe(70);
    expect(totalBudget({ ...draft, budgetType: 'lifetime', budgetAmount: 50 })).toBe(50);
  });

  it('the launch fee is charged on the whole planned spend', () => {
    expect(launchFee(draft)).toEqual({ platformBudget: 70, fee: 8.4, total: 78.4, feeRate: 0.12 });
  });
});

describe('placementsPayload', () => {
  it('groups placements per Meta publisher, in Zernio positions', () => {
    expect(placementsPayload(['facebook_feed', 'instagram_stories', 'instagram_reels'])).toEqual({
      publisherPlatforms: ['facebook', 'instagram'],
      facebookPositions: ['feed'],
      instagramPositions: ['story', 'reels']
    });
  });
});

describe('scheduleFor', () => {
  it('ends the campaign `days` after it starts', () => {
    const start = new Date('2026-10-01T10:00:00.000Z');
    expect(scheduleFor(start, 3)).toEqual({ startsAt: '2026-10-01T10:00:00.000Z', endsAt: '2026-10-04T10:00:00.000Z' });
  });
});
