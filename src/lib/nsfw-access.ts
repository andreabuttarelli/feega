export type NsfwFacts = {
  flagOn: boolean;
  verifierReady: boolean;
  planEntitled: boolean;
  orgOptedIn: boolean;
  userVerified: boolean;
};

export enum NsfwLock {
  Open = 'open',
  PlanNotEntitled = 'plan_not_entitled',
  OrgNotOptedIn = 'org_not_opted_in',
  ComingSoon = 'coming_soon',
  AgeUnverified = 'age_unverified'
}

const LOCKS_IN_ORDER: ReadonlyArray<[NsfwLock, (facts: NsfwFacts) => boolean]> = [
  [NsfwLock.PlanNotEntitled, (f) => !f.planEntitled],
  [NsfwLock.OrgNotOptedIn, (f) => !f.orgOptedIn],
  [NsfwLock.ComingSoon, (f) => !f.flagOn || !f.verifierReady],
  [NsfwLock.AgeUnverified, (f) => !f.userVerified]
];

const HIDDEN_LOCKS: ReadonlySet<NsfwLock> = new Set([NsfwLock.PlanNotEntitled, NsfwLock.OrgNotOptedIn]);

export const NSFW_LOCK_TEXT: Readonly<Record<NsfwLock, string>> = {
  [NsfwLock.Open]: 'NSFW workspace',
  [NsfwLock.PlanNotEntitled]: 'NSFW mode needs a paid plan.',
  [NsfwLock.OrgNotOptedIn]: 'The workspace owner has not enabled NSFW mode.',
  [NsfwLock.ComingSoon]: 'Age verification coming soon',
  [NsfwLock.AgeUnverified]: 'Verify your age to open the NSFW workspace.'
};

export function nsfwLock(facts: NsfwFacts): NsfwLock {
  return LOCKS_IN_ORDER.find(([, locked]) => locked(facts))?.[0] ?? NsfwLock.Open;
}

export function nsfwSectionVisible(lock: NsfwLock): boolean {
  return !HIDDEN_LOCKS.has(lock);
}
