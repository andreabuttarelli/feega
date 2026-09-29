import { describe, expect, it } from 'vitest';
import { judgeDecision, MODERATION_CATEGORIES, mentionsMinor, parseJudgeVerdict } from './policy';

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

describe('the escalation judge verdict', () => {
  it('reads a strict JSON verdict', () => {
    expect(parseJudgeVerdict('{"allowed":true,"category":"safe","reason":"landscape"}')).toEqual({
      allowed: true,
      category: 'safe',
      reason: 'landscape'
    });
  });

  it('refuses when the verdict is not readable JSON', () => {
    expect(parseJudgeVerdict('sure, looks fine')).toMatchObject({ allowed: false });
  });

  it('refuses when allowed is anything but true', () => {
    expect(parseJudgeVerdict('{"allowed":"yes","category":"safe"}')).toMatchObject({ allowed: false });
  });
});
