export type ModerationCategory = {
  instructions: string;
  refusal: string;
  escalateAbove: number;
  refuseAbove?: number;
  clearAtLeast?: number;
};

const DOUBT = 0.02;
const ZERO_TOLERANCE = 0.005;
const CONFIDENT_SAFE = 0.98;

export const SAFE = 'safe';
export const MINORS = 'minors';

export const MODERATION_CATEGORIES: Readonly<Record<string, ModerationCategory>> = {
  [SAFE]: {
    instructions: 'Nothing below applies: an ordinary creative request, including consensual adult content between fictional adults.',
    refusal: '',
    escalateAbove: DOUBT,
    clearAtLeast: CONFIDENT_SAFE
  },
  [MINORS]: {
    instructions: 'Any minor, child, teenager or childlike body in a sexual, suggestive or nude context, or any request that sexualises youth.',
    refusal: 'Refused: content that sexualises minors is never generated.',
    escalateAbove: ZERO_TOLERANCE,
    refuseAbove: ZERO_TOLERANCE
  },
  real_person_sexual: {
    instructions: 'Sexual, nude or explicit content depicting a real, identifiable person (celebrity, public figure, or a named or photographed individual).',
    refusal: 'Refused: sexual content depicting real, identifiable people is never generated.',
    escalateAbove: DOUBT
  },
  non_consensual_sexual: {
    instructions: 'Sexual violence, coercion, non-consent, intoxicated or unconscious sexual scenarios, voyeurism or revenge content.',
    refusal: 'Refused: non-consensual sexual content is never generated.',
    escalateAbove: DOUBT
  },
  violence_gore: {
    instructions: 'Graphic violence, gore, mutilation, torture or realistic depictions of killing.',
    refusal: 'Refused: graphic violence and gore are never generated.',
    escalateAbove: ZERO_TOLERANCE,
    refuseAbove: ZERO_TOLERANCE
  },
  animals_sexual: {
    instructions: 'Any animal in a sexual, suggestive or nude-erotic context, or any request combining animals with sexual acts (bestiality, zoophilia).',
    refusal: 'Refused: sexual content involving animals is never generated.',
    escalateAbove: ZERO_TOLERANCE,
    refuseAbove: ZERO_TOLERANCE
  },
  self_harm: {
    instructions: 'Self-harm, suicide, eating disorders presented approvingly or instructionally.',
    refusal: 'Refused: self-harm content is not generated.',
    escalateAbove: DOUBT
  },
  hate: {
    instructions: 'Hate symbols, slurs, dehumanisation or harassment targeting a protected group.',
    refusal: 'Refused: hateful content is not generated.',
    escalateAbove: DOUBT
  },
  weapons_terror: {
    instructions: 'Terrorist propaganda, extremist symbols, or instructions and promotion for weapons or explosives.',
    refusal: 'Refused: weapons and terror content is not generated.',
    escalateAbove: DOUBT
  }
};

export type JevDecision = { choice: string; probabilities: Record<string, number> };

export type Verdict =
  | { kind: 'clear' }
  | { kind: 'escalate'; reason: string }
  | { kind: 'refuse'; category: string; message: string };

function refuse(category: string): Verdict {
  return { kind: 'refuse', category, message: MODERATION_CATEGORIES[category]?.refusal || `Refused: ${category}` };
}

export function judgeDecision(decision: JevDecision): Verdict {
  const p = (category: string) => decision.probabilities[category] ?? 0;

  for (const [name, category] of Object.entries(MODERATION_CATEGORIES)) {
    if (category.refuseAbove !== undefined && p(name) > category.refuseAbove) {
      return refuse(name);
    }
  }

  if (decision.choice !== SAFE) {
    return refuse(decision.choice);
  }

  const safe = MODERATION_CATEGORIES[SAFE];
  if (p(SAFE) < (safe.clearAtLeast ?? 1)) {
    return { kind: 'escalate', reason: `safe at ${p(SAFE)}` };
  }

  const doubted = Object.entries(MODERATION_CATEGORIES).find(([name, category]) => name !== SAFE && p(name) > category.escalateAbove);
  return doubted ? { kind: 'escalate', reason: `${doubted[0]} at ${p(doubted[0])}` } : { kind: 'clear' };
}

const MINOR_PATTERNS: readonly RegExp[] = [
  /\b(child|children|kid|kids|toddler|infant|baby|minor|minors|underage|preteen|pre-teen|teen|teens|teenage|teenager|loli|lolita|shota|jailbait)\b/i,
  /\bschool\s?(girl|boy)s?\b/i,
  /\b(1[0-7]|[1-9])[\s-]*(years?|yrs?|y\/?o)[\s-]*old\b/i,
  /\b(young|little)\s+(girl|boy)s?\b/i
];

export function mentionsMinor(text: string): boolean {
  return MINOR_PATTERNS.some((pattern) => pattern.test(text));
}

export type JudgeVerdict = { allowed: boolean; category: string; reason: string };

const UNREADABLE_VERDICT: JudgeVerdict = { allowed: false, category: 'unknown', reason: 'the moderator gave no readable verdict' };

export function parseJudgeVerdict(raw: string): JudgeVerdict {
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    const parsed = JSON.parse(json) as Partial<JudgeVerdict>;
    return {
      allowed: parsed.allowed === true,
      category: typeof parsed.category === 'string' ? parsed.category : 'unknown',
      reason: typeof parsed.reason === 'string' ? parsed.reason : ''
    };
  } catch {
    return UNREADABLE_VERDICT;
  }
}

export const JUDGE_SYSTEM = [
  'You are a strict content-safety moderator for an image and video generator.',
  'Decide whether the request below may be generated. Refuse when in doubt.',
  'Categories that must be refused:',
  ...Object.entries(MODERATION_CATEGORIES)
    .filter(([name]) => name !== SAFE)
    .map(([name, category]) => `- ${name}: ${category.instructions}`),
  'Answer with JSON only: {"allowed": boolean, "category": string, "reason": string}.'
].join('\n');
