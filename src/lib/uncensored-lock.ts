export type UncensoredFacts = {
  flagOn: boolean;
  verifierReady: boolean;
  planEntitled: boolean;
  orgOptedIn: boolean;
  userVerified: boolean;
};

export enum UncensoredLock {
  Open = 'open',
  PlanNotEntitled = 'plan_not_entitled',
  OrgNotOptedIn = 'org_not_opted_in',
  ComingSoon = 'coming_soon',
  AgeUnverified = 'age_unverified'
}

const LOCKS_IN_ORDER: ReadonlyArray<[UncensoredLock, (facts: UncensoredFacts) => boolean]> = [
  [UncensoredLock.PlanNotEntitled, (f) => !f.planEntitled],
  [UncensoredLock.OrgNotOptedIn, (f) => !f.orgOptedIn],
  [UncensoredLock.ComingSoon, (f) => !f.flagOn || !f.verifierReady],
  [UncensoredLock.AgeUnverified, (f) => !f.userVerified]
];

const HIDDEN_LOCKS: ReadonlySet<UncensoredLock> = new Set([UncensoredLock.PlanNotEntitled, UncensoredLock.OrgNotOptedIn]);

export const UNCENSORED_LOCK_TEXT: Readonly<Record<UncensoredLock, string>> = {
  [UncensoredLock.Open]: 'Uncensored workspace',
  [UncensoredLock.PlanNotEntitled]: 'Uncensored mode needs a paid plan.',
  [UncensoredLock.OrgNotOptedIn]: 'The workspace owner has not enabled uncensored mode.',
  [UncensoredLock.ComingSoon]: 'Age verification coming soon',
  [UncensoredLock.AgeUnverified]: 'Verify your age to open the uncensored workspace.'
};

export function uncensoredLock(facts: UncensoredFacts): UncensoredLock {
  return LOCKS_IN_ORDER.find(([, locked]) => locked(facts))?.[0] ?? UncensoredLock.Open;
}

export function uncensoredSectionVisible(lock: UncensoredLock): boolean {
  return !HIDDEN_LOCKS.has(lock);
}
