import { describe, expect, it } from 'vitest';
import { photoQuality, QualityIssue, QUALITY_RULES } from './photo-quality';

const good = { width: 2000, height: 2000, bytes: 1_000_000, mimeType: 'image/jpeg' };

describe('photoQuality', () => {
  it('una foto grande e quadrata passa senza note', () => {
    expect(photoQuality(good)).toEqual({ ok: true, issues: [] });
  });

  it.each([
    [{ ...good, mimeType: 'application/pdf' }, QualityIssue.NotAPhoto, false],
    [{ ...good, bytes: 9_000_000 }, QualityIssue.TooHeavy, false],
    [{ ...good, width: 300, height: 300 }, QualityIssue.TooSmall, false],
    [{ ...good, width: 800, height: 800 }, QualityIssue.LowResolution, true],
    [{ ...good, width: 3000, height: 800 }, QualityIssue.OddShape, true]
  ])('%o → %s', (photo, issue, ok) => {
    const verdict = photoQuality(photo);
    expect(verdict.ok).toBe(ok);
    expect(verdict.issues.map((i) => i.id)).toContain(issue);
  });

  it('ogni regola dice cosa fare, non solo cosa non va', () => {
    for (const rule of Object.values(QUALITY_RULES)) {
      expect(rule.problem).toBeTruthy();
      expect(rule.fix).toBeTruthy();
    }
  });
});
