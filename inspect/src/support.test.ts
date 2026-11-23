import { describe, expect, it } from 'vitest';
import { SUPPORT_ITEMS, SupportItem, supportSummary } from './support';

describe('the support items', () => {
  it('keep the ids the server accepts', () => {
    expect(Object.values(SupportItem)).toEqual(['star', 'follow_x', 'discord', 'coffee', 'share']);
  });

  it('list every item once, with its link', () => {
    expect(SUPPORT_ITEMS.map((i) => i.id)).toEqual(Object.values(SupportItem));
    expect(SUPPORT_ITEMS.filter((i) => i.url).map((i) => [i.id, i.url])).toEqual([
      [SupportItem.Star, 'https://github.com/andreabuttarelli/feega'],
      [SupportItem.FollowX, 'https://x.com/feega_app'],
      [SupportItem.Discord, 'https://discord.gg/PUp37DG6vr'],
      [SupportItem.Coffee, 'https://buy.stripe.com/5kQ00k2A97C08sd94LeME07']
    ]);
  });

  it('share carries a text that links to the site', () => {
    const share = SUPPORT_ITEMS.find((i) => i.id === SupportItem.Share);

    expect(share?.url).toBeUndefined();
    expect(share?.text).toContain('https://www.feega.app');
  });
});

describe('the support summary', () => {
  it('starts at zero karma, not complete', () => {
    expect(supportSummary([])).toEqual({ karma: 0, complete: false });
  });

  it('adds the karma of what was done', () => {
    const karma = SUPPORT_ITEMS.filter((i) => [SupportItem.Star, SupportItem.Discord].includes(i.id)).reduce((sum, i) => sum + i.karma, 0);

    expect(supportSummary([SupportItem.Star, SupportItem.Discord])).toEqual({ karma, complete: false });
  });

  it('counts an item once however often it is done', () => {
    expect(supportSummary([SupportItem.Star, SupportItem.Star]).karma).toBe(supportSummary([SupportItem.Star]).karma);
  });

  it('is complete when every item is done', () => {
    expect(supportSummary(Object.values(SupportItem)).complete).toBe(true);
  });
});
