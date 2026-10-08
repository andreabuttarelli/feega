import { describe, expect, it } from 'vitest';
import {
  GENERIC,
  IDENTIFIABILITY_CATEGORIES,
  identifiabilityDecision,
  judgeDecision,
  MODERATION_CATEGORIES,
  mentionsMinor,
  parseJudgeVerdict,
  judgeSystem
} from './policy';

const only = (choice: string, overrides: Record<string, number> = {}) => {
  const probabilities: Record<string, number> = Object.fromEntries(Object.keys(MODERATION_CATEGORIES).map((c) => [c, 0]));
  return { choice, probabilities: { ...probabilities, ...overrides } };
};

describe('the moderation threshold table', () => {
  it('clears a confident safe decision', () => {
    expect(judgeDecision(only('safe', { safe: 0.995, hate: 0.005 })).kind).toBe('clear');
  });

  it('refuses when the top choice is an unsafe category', () => {
    const verdict = judgeDecision(only('violence_gore', { violence_gore: 0.7, safe: 0.3 }));
    expect(verdict).toMatchObject({ kind: 'refuse', category: 'violence_gore' });
  });

  it('escalates a safe decision whose safe probability is below the clear threshold', () => {
    expect(judgeDecision(only('safe', { safe: 0.95, hate: 0.01 })).kind).toBe('escalate');
  });

  it('escalates a safe decision with any unsafe category above the doubt threshold', () => {
    expect(judgeDecision(only('safe', { safe: 0.98, self_harm: 0.03 })).kind).toBe('escalate');
  });

  it('refuses minors with any non-trivial probability, without escalating', () => {
    const verdict = judgeDecision(only('safe', { safe: 0.99, minors: 0.01 }));
    expect(verdict).toMatchObject({ kind: 'refuse', category: 'minors' });
  });

  it.each(['violence_gore', 'animals_sexual'])('refuses %s with any non-trivial probability, without escalating', (category) => {
    const verdict = judgeDecision(only('safe', { safe: 0.99, [category]: 0.01 }));
    expect(verdict).toMatchObject({ kind: 'refuse', category });
  });

  it('refuses sexual content involving animals when it is the top choice', () => {
    expect(judgeDecision(only('animals_sexual', { animals_sexual: 0.6, safe: 0.4 }))).toMatchObject({ kind: 'refuse', category: 'animals_sexual' });
  });

  it('every category carries a readable refusal and a threshold', () => {
    for (const [name, category] of Object.entries(MODERATION_CATEGORIES)) {
      expect(category.instructions.length, name).toBeGreaterThan(10);
      expect(category.escalateAbove, name).toBeGreaterThan(0);
    }
  });
});

describe('the minors keyword rule', () => {
  it.each(['a 16 year old girl', 'schoolgirl in uniform', 'teen model', 'young child on a bed', 'underage'])('flags %s', (text) => {
    expect(mentionsMinor(text)).toBe(true);
  });

  it.each(['a 25 year old woman', 'adult couple at the beach', 'a kidney-shaped pool'])('does not flag %s', (text) => {
    expect(mentionsMinor(text)).toBe(false);
  });
});

describe('the identifiability threshold table', () => {
  const identOnly = (choice: string, overrides: Record<string, number> = {}) => {
    const probabilities: Record<string, number> = Object.fromEntries(Object.keys(IDENTIFIABILITY_CATEGORIES).map((c) => [c, 0]));
    return { choice, probabilities: { ...probabilities, ...overrides } };
  };

  it('clears a confident generic decision', () => {
    expect(identifiabilityDecision(identOnly(GENERIC, { generic: 0.99 })).kind).toBe('clear');
  });

  it('refuses when the top choice is a non-generic category', () => {
    const verdict = identifiabilityDecision(identOnly('distinctive_marks', { distinctive_marks: 0.8, generic: 0.2 }));
    expect(verdict).toMatchObject({ kind: 'refuse', category: 'distinctive_marks' });
  });

  it('escalates a generic decision with any doubt above threshold', () => {
    expect(identifiabilityDecision(identOnly(GENERIC, { generic: 0.9, specific_face: 0.05 })).kind).toBe('escalate');
  });

  it('every identifiability category carries a readable refusal and a threshold', () => {
    for (const [name, category] of Object.entries(IDENTIFIABILITY_CATEGORIES)) {
      expect(category.instructions.length, name).toBeGreaterThan(10);
      expect(category.escalateAbove, name).toBeGreaterThan(0);
    }
  });

  it('names the four non-generic identifiability categories', () => {
    expect(Object.keys(IDENTIFIABILITY_CATEGORIES).filter((c) => c !== GENERIC).sort()).toEqual(
      ['distinctive_marks', 'named_or_referenced_person', 'personal_context', 'specific_face'].sort()
    );
  });
});

describe('the escalation judge verdict', () => {
  it('reads a strict JSON verdict', () => {
    expect(parseJudgeVerdict('{"allowed":true,"category":"safe","reason":"landscape"}')).toEqual({
      allowed: true,
      category: 'safe',
      requested: true,
      reason: 'landscape'
    });
  });

  it('refuses when the verdict is not readable JSON', () => {
    expect(parseJudgeVerdict('sure, looks fine')).toMatchObject({ allowed: false });
  });

  it('refuses when allowed is anything but true', () => {
    expect(parseJudgeVerdict('{"allowed":"yes","category":"safe"}')).toMatchObject({ allowed: false });
  });

  it('reads whether the content was asked for, and assumes it was when the judge does not say', () => {
    expect(parseJudgeVerdict('{"allowed":false,"category":"real_person_sexual","requested":false,"reason":"only a URL"}')).toMatchObject({ requested: false });
    expect(parseJudgeVerdict('{"allowed":false,"category":"hate","reason":"slur"}')).toMatchObject({ requested: true });
  });

  it('tells the judge that a URL, a name or a website is material to read, not a request', () => {
    const system = judgeSystem(MODERATION_CATEGORIES);
    expect(system).toContain('"requested": boolean');
    expect(system).toMatch(/URL/);
  });
});
