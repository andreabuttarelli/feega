import { describe, expect, it } from 'vitest';
import { NsfwLock, nsfwLock, nsfwSectionVisible, type NsfwFacts } from './nsfw-access';

const OPEN: NsfwFacts = { flagOn: true, verifierReady: true, planEntitled: true, orgOptedIn: true, userVerified: true };

describe('the nsfw entitlement matrix', () => {
  const rows: Array<[Partial<NsfwFacts>, NsfwLock]> = [
    [{}, NsfwLock.Open],
    [{ flagOn: false }, NsfwLock.ComingSoon],
    [{ verifierReady: false }, NsfwLock.ComingSoon],
    [{ verifierReady: false, userVerified: false }, NsfwLock.ComingSoon],
    [{ planEntitled: false }, NsfwLock.PlanNotEntitled],
    [{ planEntitled: false, orgOptedIn: false }, NsfwLock.PlanNotEntitled],
    [{ orgOptedIn: false }, NsfwLock.OrgNotOptedIn],
    [{ orgOptedIn: false, userVerified: false }, NsfwLock.OrgNotOptedIn],
    [{ userVerified: false }, NsfwLock.AgeUnverified],
    [{ flagOn: false, planEntitled: false }, NsfwLock.PlanNotEntitled]
  ];

  it.each(rows)('%o locks as %s', (override, lock) => {
    expect(nsfwLock({ ...OPEN, ...override })).toBe(lock);
  });

  it('the section is hidden from a workspace that is not entitled or not opted in', () => {
    expect(nsfwSectionVisible(NsfwLock.PlanNotEntitled)).toBe(false);
    expect(nsfwSectionVisible(NsfwLock.OrgNotOptedIn)).toBe(false);
    expect(nsfwSectionVisible(NsfwLock.ComingSoon)).toBe(true);
    expect(nsfwSectionVisible(NsfwLock.AgeUnverified)).toBe(true);
    expect(nsfwSectionVisible(NsfwLock.Open)).toBe(true);
  });
});
