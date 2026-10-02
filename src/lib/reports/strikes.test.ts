import { describe, expect, it } from 'vitest';
import { ReportReason } from './reasons';
import { Standing, standingFor, strikeWeight } from './strikes';

describe('repeat-infringer policy', () => {
  it('a clean account is in good standing', () => {
    expect(standingFor(0)).toBe(Standing.Good);
  });

  it('one strike is a warning', () => {
    expect(standingFor(strikeWeight(ReportReason.Copyright))).toBe(Standing.Warned);
  });

  it('two strikes suspend', () => {
    expect(standingFor(strikeWeight(ReportReason.Copyright) * 2)).toBe(Standing.Suspended);
  });

  it('three strikes terminate', () => {
    expect(standingFor(strikeWeight(ReportReason.Copyright) * 3)).toBe(Standing.Terminated);
  });

  it('a single CSAM strike terminates', () => {
    expect(standingFor(strikeWeight(ReportReason.Csam))).toBe(Standing.Terminated);
  });

  it('a likeness strike counts double', () => {
    expect(standingFor(strikeWeight(ReportReason.Likeness))).toBe(Standing.Suspended);
  });
});
