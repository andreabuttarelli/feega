import { describe, expect, it } from 'vitest';
import { BriefPhase, briefPhaseAfter, briefProgress } from './brief-progress';

describe('brief progress', () => {
  it('ogni fase ha il suo testo', () => {
    expect(briefProgress(BriefPhase.Creating)).toBe('creating your project…');
    expect(briefProgress(BriefPhase.Opening)).toBe('opening the editor…');
    expect(briefProgress(BriefPhase.Idle)).toBe('');
  });

  it("un redirect apre l'editor, ogni altro esito torna fermo", () => {
    expect(briefPhaseAfter('redirect')).toBe(BriefPhase.Opening);
    expect(briefPhaseAfter('failure')).toBe(BriefPhase.Idle);
    expect(briefPhaseAfter('error')).toBe(BriefPhase.Idle);
  });
});
