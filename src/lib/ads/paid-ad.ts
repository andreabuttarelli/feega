import { feeBreakdown } from '$lib/ads-fee';

export const OBJECTIVES = [
  { id: 'traffic', label: 'Traffic', hint: 'Send people to your link', needsLink: true },
  { id: 'engagement', label: 'Engagement', hint: 'Likes, comments and shares', needsLink: false },
  { id: 'awareness', label: 'Awareness', hint: 'Reach as many people as possible', needsLink: false }
] as const;
export type Objective = (typeof OBJECTIVES)[number]['id'];

export const PLACEMENTS = [
  { id: 'facebook_feed', label: 'Facebook feed', publisher: 'facebook', position: 'feed' },
  { id: 'instagram_feed', label: 'Instagram feed', publisher: 'instagram', position: 'stream' },
  { id: 'facebook_stories', label: 'Facebook stories', publisher: 'facebook', position: 'story' },
  { id: 'instagram_stories', label: 'Instagram stories', publisher: 'instagram', position: 'story' },
  { id: 'facebook_reels', label: 'Facebook reels', publisher: 'facebook', position: 'facebook_reels' },
  { id: 'instagram_reels', label: 'Instagram reels', publisher: 'instagram', position: 'reels' }
] as const;
export type PlacementId = (typeof PLACEMENTS)[number]['id'];

export const CALLS_TO_ACTION = [
  { id: 'LEARN_MORE', label: 'Learn more' },
  { id: 'SHOP_NOW', label: 'Shop now' },
  { id: 'SIGN_UP', label: 'Sign up' },
  { id: 'BOOK_NOW', label: 'Book now' },
  { id: 'CONTACT_US', label: 'Contact us' },
  { id: 'ORDER_NOW', label: 'Order now' }
] as const;
export type CallToAction = (typeof CALLS_TO_ACTION)[number]['id'];

export const GENDERS = [
  { id: 'all', label: 'All', zernio: [] as string[] },
  { id: 'female', label: 'Women', zernio: ['female'] },
  { id: 'male', label: 'Men', zernio: ['male'] }
] as const;
export type Gender = (typeof GENDERS)[number]['id'];

export const META_MIN_AGE = 18;
export const META_MAX_AGE = 65;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PaidAdDraft = {
  brandId: string;
  adAccountId: string;
  objective: Objective;
  budgetType: 'daily' | 'lifetime';
  budgetAmount: number;
  days: number;
  countries: string[];
  ageMin: number;
  ageMax: number;
  gender: Gender;
  placements: PlacementId[];
  primaryText: string;
  headline: string;
  callToAction: CallToAction;
  linkUrl: string;
  mediaNodeIds: string[];
  postId: string | null;
};

export type DraftProblem = { field: string; reason: string };

const blank = (s: string) => !s.trim();
const needsLink = (d: PaidAdDraft) => OBJECTIVES.find((o) => o.id === d.objective)?.needsLink ?? true;

const DRAFT_RULES: Array<{ field: string; broken: (d: PaidAdDraft) => boolean; reason: string }> = [
  { field: 'adAccountId', broken: (d) => blank(d.adAccountId), reason: 'Pick a Meta ad account.' },
  { field: 'budgetAmount', broken: (d) => !(d.budgetAmount >= 1), reason: 'Budget must be at least 1.' },
  { field: 'days', broken: (d) => !(Number.isInteger(d.days) && d.days >= 1), reason: 'Run it for at least one day.' },
  { field: 'countries', broken: (d) => d.countries.length === 0, reason: 'Pick at least one country.' },
  {
    field: 'age',
    broken: (d) => d.ageMin < META_MIN_AGE || d.ageMax > META_MAX_AGE || d.ageMin > d.ageMax,
    reason: `Ages go from ${META_MIN_AGE} to ${META_MAX_AGE}, youngest first.`
  },
  { field: 'placements', broken: (d) => d.placements.length === 0, reason: 'Pick at least one placement.' },
  { field: 'primaryText', broken: (d) => blank(d.primaryText), reason: 'Write the primary text.' },
  { field: 'headline', broken: (d) => blank(d.headline), reason: 'Write a headline.' },
  { field: 'linkUrl', broken: (d) => needsLink(d) && blank(d.linkUrl), reason: 'Traffic ads need a link.' },
  {
    field: 'media',
    broken: (d) => d.postId === null && d.mediaNodeIds.length === 0,
    reason: 'Select an image or a video on the canvas.'
  }
];

export function draftProblems(draft: PaidAdDraft): DraftProblem[] {
  return DRAFT_RULES.filter((rule) => rule.broken(draft)).map(({ field, reason }) => ({ field, reason }));
}

export function totalBudget(draft: Pick<PaidAdDraft, 'budgetType' | 'budgetAmount' | 'days'>): number {
  return draft.budgetType === 'daily' ? draft.budgetAmount * draft.days : draft.budgetAmount;
}

export function launchFee(draft: Pick<PaidAdDraft, 'budgetType' | 'budgetAmount' | 'days'>) {
  return feeBreakdown(totalBudget(draft));
}

export type ZernioPlacements = {
  publisherPlatforms: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
};

export function placementsPayload(ids: string[]): ZernioPlacements {
  const chosen = PLACEMENTS.filter((p) => ids.includes(p.id));
  const positionsOf = (publisher: string) => chosen.filter((p) => p.publisher === publisher).map((p) => p.position);
  const payload: ZernioPlacements = { publisherPlatforms: [...new Set(chosen.map((p) => p.publisher))] };
  const facebook = positionsOf('facebook');
  const instagram = positionsOf('instagram');
  if (facebook.length) {
    payload.facebookPositions = facebook;
  }
  if (instagram.length) {
    payload.instagramPositions = instagram;
  }
  return payload;
}

export function scheduleFor(start: Date, days: number): { startsAt: string; endsAt: string } {
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + days * DAY_MS).toISOString() };
}

export function zernioGenders(gender: Gender): string[] {
  return [...(GENDERS.find((g) => g.id === gender)?.zernio ?? [])];
}
