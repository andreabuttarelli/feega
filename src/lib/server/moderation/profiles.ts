import { ProjectMode } from '$lib/project-mode';
import { DOUBT, MODERATION_CATEGORIES, SAFE, type ModerationCategories } from './policy';

export enum ModerationProfile {
  Standard = 'standard',
  Uncensored = 'uncensored'
}

export enum JevOutage {
  Judge = 'judge',
  Refuse = 'refuse'
}

export enum JudgeTier {
  Cheapest = 'cheapest',
  Best = 'best'
}

export type ProfilePolicy = {
  categories: ModerationCategories;
  onJevOutage: JevOutage;
  judgeTier: JudgeTier;
  judgeRefusal: string;
};

export const ADULT_SEXUAL = 'adult_sexual';

const blocked = (what: string) => `This prompt was blocked: ${what} in feega's standard mode.`;

const STANDARD_REFUSALS: Readonly<Record<string, string>> = {
  [SAFE]: '',
  minors: blocked("content sexualising minors isn't allowed"),
  real_person_sexual: blocked("sexual content isn't allowed"),
  non_consensual_sexual: blocked("sexual content isn't allowed"),
  violence_gore: blocked("violence and gore aren't allowed"),
  animals_sexual: blocked("sexual content isn't allowed"),
  self_harm: blocked("self-harm content isn't allowed"),
  hate: blocked("hateful content isn't allowed"),
  weapons_terror: blocked("weapons and terror content isn't allowed"),
  [ADULT_SEXUAL]: blocked("sexual content isn't allowed")
};

const STANDARD_CATEGORIES: ModerationCategories = {
  ...Object.fromEntries(Object.entries(MODERATION_CATEGORIES).map(([name, category]) => [name, { ...category, refusal: STANDARD_REFUSALS[name] }])),
  [SAFE]: {
    ...MODERATION_CATEGORIES[SAFE],
    instructions: 'Nothing below applies: an ordinary, general-audience creative request.'
  },
  [ADULT_SEXUAL]: {
    instructions: 'Any sexual, erotic, pornographic, nude or sexually suggestive content of any kind, including between consenting adults.',
    refusal: STANDARD_REFUSALS[ADULT_SEXUAL],
    escalateAbove: DOUBT
  }
};

export const MODERATION_PROFILES: Readonly<Record<ModerationProfile, ProfilePolicy>> = {
  [ModerationProfile.Standard]: {
    categories: STANDARD_CATEGORIES,
    onJevOutage: JevOutage.Judge,
    judgeTier: JudgeTier.Cheapest,
    judgeRefusal: blocked("this content isn't allowed")
  },
  [ModerationProfile.Uncensored]: {
    categories: MODERATION_CATEGORIES,
    onJevOutage: JevOutage.Refuse,
    judgeTier: JudgeTier.Best,
    judgeRefusal: 'Refused by the safety review'
  }
};

const PROFILE_BY_MODE: Readonly<Record<ProjectMode, Readonly<Record<'uncensored' | 'standard', ModerationProfile>>>> = {
  [ProjectMode.Standard]: { uncensored: ModerationProfile.Standard, standard: ModerationProfile.Standard },
  [ProjectMode.Nsfw]: { uncensored: ModerationProfile.Uncensored, standard: ModerationProfile.Standard }
};

export function profileOf(input: { uncensored: boolean; mode: ProjectMode }): ModerationProfile {
  return PROFILE_BY_MODE[input.mode][input.uncensored ? 'uncensored' : 'standard'];
}

export function carriedProfile(carrier: { uncensored: boolean }): ModerationProfile {
  return carrier.uncensored ? ModerationProfile.Uncensored : ModerationProfile.Standard;
}
