import { describe, expect, it } from 'vitest';
import { judgeDecision, SAFE } from './policy';
import { ProjectMode } from '$lib/project-mode';
import { ADULT_SEXUAL, JevOutage, MODERATION_PROFILES, ModerationProfile, profileOf } from './profiles';

const decided = (profile: ModerationProfile, choice: string, overrides: Record<string, number> = {}) => {
  const zeros = Object.fromEntries(Object.keys(MODERATION_PROFILES[profile].categories).map((c) => [c, 0]));
  return judgeDecision({ choice, probabilities: { ...zeros, ...overrides } }, MODERATION_PROFILES[profile].categories);
};

describe('the moderation profile table', () => {
  it('refuses adult sexual content in standard mode', () => {
    expect(decided(ModerationProfile.Standard, ADULT_SEXUAL, { [ADULT_SEXUAL]: 0.9, safe: 0.1 })).toMatchObject({
      kind: 'refuse',
      category: ADULT_SEXUAL,
      message: "This prompt was blocked: sexual content isn't allowed in feega's standard mode."
    });
  });

  it('does not refuse adult sexual content in uncensored mode, where it is not a category', () => {
    expect(MODERATION_PROFILES[ModerationProfile.Uncensored].categories[ADULT_SEXUAL]).toBeUndefined();
    expect(MODERATION_PROFILES[ModerationProfile.Uncensored].categories[SAFE].instructions).toMatch(/consensual adult/);
    expect(MODERATION_PROFILES[ModerationProfile.Standard].categories[SAFE].instructions).not.toMatch(/adult/);
  });

  it.each(['minors', 'real_person_sexual', 'non_consensual_sexual', 'violence_gore', 'animals_sexual', 'self_harm', 'hate', 'weapons_terror', ADULT_SEXUAL])(
    'standard mode refuses %s with a readable message',
    (category) => {
      const verdict = decided(ModerationProfile.Standard, category, { [category]: 0.9, safe: 0.1 });
      expect(verdict).toMatchObject({ kind: 'refuse', category });
      expect(verdict.kind === 'refuse' && verdict.message).toMatch(/^This prompt was blocked: .+ standard mode\.$/);
    }
  );

  it('escalates doubtful adult content in standard mode instead of clearing it', () => {
    expect(decided(ModerationProfile.Standard, SAFE, { safe: 0.98, [ADULT_SEXUAL]: 0.03 }).kind).toBe('escalate');
  });

  it('falls back to the LLM judge when Jev is down in standard mode, and refuses in uncensored mode', () => {
    expect(MODERATION_PROFILES[ModerationProfile.Standard].onJevOutage).toBe(JevOutage.Judge);
    expect(MODERATION_PROFILES[ModerationProfile.Uncensored].onJevOutage).toBe(JevOutage.Refuse);
  });

  it.each([
    [ProjectMode.Uncensored, true, ModerationProfile.Uncensored],
    [ProjectMode.Uncensored, false, ModerationProfile.Standard],
    [ProjectMode.Standard, true, ModerationProfile.Standard],
    [ProjectMode.Standard, false, ModerationProfile.Standard]
  ])('picks the profile from project mode %s and model uncensored=%s: %s', (mode, uncensored, profile) => {
    expect(profileOf({ uncensored, mode })).toBe(profile);
  });
});
