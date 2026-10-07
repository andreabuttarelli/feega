import { describe, expect, it } from 'vitest';
import { CLONE_MAX_SECONDS, CLONE_MIN_SECONDS, cloneRefusal, slotsLeft, VOICE_SLOTS_BY_PLAN } from './voices';
import { ProjectMode } from '$lib/project-mode';

const OWN = { consentBasis: 'own_voice', speaker: '', attested: true, seconds: CLONE_MIN_SECONDS, mode: ProjectMode.Standard } as const;

describe('voice slots', () => {
  it('give an org what its plan allows minus what it already made', () => {
    expect(slotsLeft({ plan: 'pro', used: 1, account: { used: 0, limit: 1000 } })).toBe(VOICE_SLOTS_BY_PLAN.pro - 1);
  });

  it('never promise more than the shared account still has', () => {
    expect(slotsLeft({ plan: 'pro', used: 0, account: { used: 29, limit: 30 } })).toBe(1);
  });

  it('read an org without a plan as the smallest quota and never go below zero', () => {
    expect(slotsLeft({ plan: null, used: 99, account: { used: 0, limit: 30 } })).toBe(0);
    expect(slotsLeft({ plan: null, used: 0, account: { used: 0, limit: 30 } })).toBe(VOICE_SLOTS_BY_PLAN.none);
  });
});

describe('cloning a voice', () => {
  it('passes for the user own voice, attested, long enough', () => {
    expect(cloneRefusal(OWN)).toBeNull();
  });

  it('needs the attestation', () => {
    expect(cloneRefusal({ ...OWN, attested: false })).toBe('consent_required');
  });

  it('needs the name of the consenting speaker when it is not the user', () => {
    expect(cloneRefusal({ ...OWN, consentBasis: 'consented_speaker', speaker: ' ' })).toBe('speaker_name_required');
    expect(cloneRefusal({ ...OWN, consentBasis: 'consented_speaker', speaker: 'Ada Rossi' })).toBeNull();
  });

  it('refuses an unknown consent basis', () => {
    expect(cloneRefusal({ ...OWN, consentBasis: 'found_online' as never })).toBe('consent_required');
  });

  it('refuses a recording shorter than the minimum or longer than the maximum', () => {
    expect(cloneRefusal({ ...OWN, seconds: CLONE_MIN_SECONDS - 1 })).toBe('recording_too_short');
    expect(cloneRefusal({ ...OWN, seconds: CLONE_MAX_SECONDS + 1 })).toBe('recording_too_long');
  });

  it('is blocked in an uncensored project', () => {
    expect(cloneRefusal({ ...OWN, mode: ProjectMode.Uncensored })).toBe('cloning_not_in_this_project');
  });
});
