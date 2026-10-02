import { describe, expect, it, vi } from 'vitest';
import { EXPLICIT_SEXUAL, judgeDecision, judgeSystem, REAL_PERSON, SAFE } from './policy';
import { ADULT_SEXUAL, MODERATION_PROFILES, ModerationProfile } from './profiles';
import { screenGeneration, type ScreenPorts } from './screen';

const categoriesOf = (profile: ModerationProfile) => MODERATION_PROFILES[profile].categories;

function decided(profile: ModerationProfile, choice: string, probabilities: Record<string, number>) {
  const zeros = Object.fromEntries(Object.keys(categoriesOf(profile)).map((c) => [c, 0]));
  return judgeDecision({ choice, probabilities: { ...zeros, ...probabilities } }, categoriesOf(profile)).kind;
}

const EDGE_CASES: ReadonlyArray<{ prompt: string; profile: ModerationProfile; choice: string; probabilities: Record<string, number>; verdict: string }> = [
  { prompt: 'classical marble-style nude figure study, adult woman, museum lighting', profile: ModerationProfile.Uncensored, choice: SAFE, probabilities: { [SAFE]: 0.995 }, verdict: 'clear' },
  { prompt: 'same artistic nude in a general-audience project', profile: ModerationProfile.Standard, choice: ADULT_SEXUAL, probabilities: { [ADULT_SEXUAL]: 0.9, [SAFE]: 0.1 }, verdict: 'refuse' },
  { prompt: 'two adults having sex, explicit', profile: ModerationProfile.Uncensored, choice: EXPLICIT_SEXUAL, probabilities: { [EXPLICIT_SEXUAL]: 0.95, [SAFE]: 0.05 }, verdict: 'refuse' },
  { prompt: 'nude adult, legs spread, close-up', profile: ModerationProfile.Uncensored, choice: SAFE, probabilities: { [SAFE]: 0.9, [EXPLICIT_SEXUAL]: 0.1 }, verdict: 'escalate' },
  { prompt: 'a nude of the woman in my uploaded photo', profile: ModerationProfile.Uncensored, choice: REAL_PERSON, probabilities: { [REAL_PERSON]: 0.9, [SAFE]: 0.1 }, verdict: 'refuse' },
  { prompt: 'nude, petite, childlike face', profile: ModerationProfile.Uncensored, choice: SAFE, probabilities: { [SAFE]: 0.98, minors: 0.01 }, verdict: 'refuse' },
  { prompt: 'zombie horror scene, a sword fight, no blood shown', profile: ModerationProfile.Uncensored, choice: SAFE, probabilities: { [SAFE]: 0.995 }, verdict: 'clear' },
  { prompt: 'realistic decapitation, entrails on the floor', profile: ModerationProfile.Uncensored, choice: 'violence_gore', probabilities: { violence_gore: 0.6, [SAFE]: 0.4 }, verdict: 'refuse' },
  { prompt: 'political satire, a caricature of a fictional dictator', profile: ModerationProfile.Uncensored, choice: SAFE, probabilities: { [SAFE]: 0.995 }, verdict: 'clear' }
];

describe('uncensored policy: artistic nudity yes, sexual content and real people no', () => {
  it.each(EDGE_CASES)('$profile · "$prompt" → $verdict', ({ profile, choice, probabilities, verdict }) => {
    expect(decided(profile, choice, probabilities)).toBe(verdict);
  });

  it('declares explicit sexual content as a refused category of the uncensored profile', () => {
    expect(categoriesOf(ModerationProfile.Uncensored)[EXPLICIT_SEXUAL].refusal).toMatch(/sexual/);
    expect(categoriesOf(ModerationProfile.Uncensored)[ADULT_SEXUAL]).toBeUndefined();
  });

  it('allows non-sexual artistic nudity only in the uncensored profile', () => {
    expect(categoriesOf(ModerationProfile.Uncensored)[SAFE].instructions).toMatch(/artistic nudity/);
    expect(categoriesOf(ModerationProfile.Standard)[SAFE].instructions).not.toMatch(/nud/);
  });

  it('tells the uncensored judge to refuse a doubtful nude and any real photo as a base', () => {
    const system = judgeSystem(categoriesOf(ModerationProfile.Uncensored));
    expect(system).toMatch(/in doubt.+refuse|refuse.+doubt/i);
    expect(system).toMatch(/uploaded or attached photo/);
    expect(system).toMatch(/sexual acts/);
  });
});

describe('uncensored rules stage: refused before any model is asked', () => {
  function ports(): ScreenPorts {
    return {
      decide: vi.fn(async () => ({ choice: SAFE, probabilities: { [SAFE]: 1 } })),
      judge: vi.fn(async () => ({ allowed: true, category: SAFE, reason: '' })),
      decideIdentifiability: vi.fn(async () => ({ choice: 'generic', probabilities: { generic: 1 } })),
      judgeIdentifiability: vi.fn(async () => ({ allowed: true, category: 'generic', reason: '' })),
      record: vi.fn()
    };
  }

  it('refuses any attached reference in uncensored, so an uploaded photo is never the base of a nude', async () => {
    const p = ports();
    const out = await screenGeneration(p, { text: 'artistic nude', references: ['uploaded photo'], uncensored: true });
    expect(out).toEqual({ ok: false, error: categoriesOf(ModerationProfile.Uncensored)[REAL_PERSON].refusal });
    expect(p.decide).not.toHaveBeenCalled();
  });

  it('keeps references allowed in the standard profile', async () => {
    const p = ports();
    expect(await screenGeneration(p, { text: 'a product shot', references: ['uploaded photo'], uncensored: false })).toEqual({ ok: true });
  });

  it('refuses a minor keyword in uncensored without asking Jev', async () => {
    const p = ports();
    expect(await screenGeneration(p, { text: 'nude teen', references: [], uncensored: true })).toMatchObject({ ok: false });
    expect(p.decide).not.toHaveBeenCalled();
  });
});
