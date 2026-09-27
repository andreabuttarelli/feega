import { describe, expect, it } from 'vitest';
import { ANALYSIS_STEPS, ANALYSIS_STEP_INTERVAL_MS, analysisStepIndexAt } from './brand-wizard-analysis-steps';

describe('analysisStepIndexAt: quale fase mostrare dato il tempo trascorso', () => {
  it('è la prima fase a tempo zero', () => {
    expect(analysisStepIndexAt(0, ANALYSIS_STEPS.length)).toBe(0);
  });

  it('avanza di una fase ogni intervallo', () => {
    expect(analysisStepIndexAt(ANALYSIS_STEP_INTERVAL_MS, ANALYSIS_STEPS.length)).toBe(1);
    expect(analysisStepIndexAt(ANALYSIS_STEP_INTERVAL_MS * 2, ANALYSIS_STEPS.length)).toBe(2);
  });

  it('resta sulla fase corrente finché l\'intervallo non è passato', () => {
    expect(analysisStepIndexAt(ANALYSIS_STEP_INTERVAL_MS + 100, ANALYSIS_STEPS.length)).toBe(1);
    expect(analysisStepIndexAt(ANALYSIS_STEP_INTERVAL_MS - 1, ANALYSIS_STEPS.length)).toBe(0);
  });

  it('torna alla prima fase dopo l\'ultima — il ciclo si ripete', () => {
    const lastIndex = ANALYSIS_STEPS.length - 1;
    expect(analysisStepIndexAt(ANALYSIS_STEP_INTERVAL_MS * lastIndex, ANALYSIS_STEPS.length)).toBe(lastIndex);
    expect(analysisStepIndexAt(ANALYSIS_STEP_INTERVAL_MS * ANALYSIS_STEPS.length, ANALYSIS_STEPS.length)).toBe(0);
  });

  it('con zero fasi non esplode', () => {
    expect(analysisStepIndexAt(1000, 0)).toBe(0);
  });
});
