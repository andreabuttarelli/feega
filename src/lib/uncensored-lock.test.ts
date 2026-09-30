import { describe, expect, it } from 'vitest';
import { UNCENSORED_LOCK_TEXT, UncensoredLock, uncensoredLock, uncensoredSectionVisible, type UncensoredFacts } from './uncensored-lock';

const OPEN: UncensoredFacts = { flagOn: true, verifierReady: true, planEntitled: true, orgOptedIn: true, userVerified: true };

describe('the uncensored entitlement matrix', () => {
  const rows: Array<[Partial<UncensoredFacts>, UncensoredLock]> = [
    [{}, UncensoredLock.Open],
    [{ flagOn: false }, UncensoredLock.ComingSoon],
    [{ verifierReady: false }, UncensoredLock.ComingSoon],
    [{ verifierReady: false, userVerified: false }, UncensoredLock.ComingSoon],
    [{ planEntitled: false }, UncensoredLock.PlanNotEntitled],
    [{ planEntitled: false, orgOptedIn: false }, UncensoredLock.PlanNotEntitled],
    [{ orgOptedIn: false }, UncensoredLock.OrgNotOptedIn],
    [{ orgOptedIn: false, userVerified: false }, UncensoredLock.OrgNotOptedIn],
    [{ userVerified: false }, UncensoredLock.AgeUnverified],
    [{ flagOn: false, planEntitled: false }, UncensoredLock.PlanNotEntitled]
  ];

  it.each(rows)('%o locks as %s', (override, lock) => {
    expect(uncensoredLock({ ...OPEN, ...override })).toBe(lock);
  });

  it('the section is hidden from a workspace that is not entitled or not opted in', () => {
    expect(uncensoredSectionVisible(UncensoredLock.PlanNotEntitled)).toBe(false);
    expect(uncensoredSectionVisible(UncensoredLock.OrgNotOptedIn)).toBe(false);
    expect(uncensoredSectionVisible(UncensoredLock.ComingSoon)).toBe(true);
    expect(uncensoredSectionVisible(UncensoredLock.AgeUnverified)).toBe(true);
    expect(uncensoredSectionVisible(UncensoredLock.Open)).toBe(true);
  });
});

describe('the workspace copy', () => {
  it('calls the mode uncensored, never nsfw', () => {
    expect(Object.values(UNCENSORED_LOCK_TEXT).join(' ')).not.toMatch(/nsfw/i);
  });
});
