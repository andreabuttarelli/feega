import { describe, expect, it } from 'vitest';
import { WIZARD_STEPS, restoreWizardState } from './brand-wizard-steps';



describe('i passi del wizard brand', () => {
  it('non chiede più i concorrenti', () => {
    expect(WIZARD_STEPS).toEqual(['website', 'analysis', 'products', 'target', 'handles', 'overview']);
  });

  it('una bozza salvata sul passo concorrenti riapre sul passo handle', () => {
    const restored = restoreWizardState({ step: 'competitors', draft: { name: 'Acme' } }, { name: '' });
    expect(restored.step).toBe('handles');
    expect(restored.draft).toEqual({ name: 'Acme' });
  });

  it('una bozza vecchia perde competitorHandles e tiene il resto', () => {
    const restored = restoreWizardState(
      { step: 'target', draft: { name: 'Acme', competitorHandles: [{ platform: 'x', handle: 'rival' }] } },
      { name: '' }
    );
    expect(restored.step).toBe('target');
    expect(restored.draft).toEqual({ name: 'Acme' });

  });

  it('un salvataggio illeggibile riparte da zero', () => {
    expect(restoreWizardState(null, { name: '' })).toEqual({ step: 'website', draft: { name: '' } });
    expect(restoreWizardState({ step: 'nope' }, { name: '' })).toEqual({ step: 'website', draft: { name: '' } });
  });
});
