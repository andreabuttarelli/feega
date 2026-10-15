import { describe, expect, it } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { uncensoredRefusal, UNCENSORED_REFUSALS, type GuardFacts } from './uncensored-guard';

const allowed: GuardFacts = { uncensored: true, mode: ProjectMode.Uncensored, carriesInputs: false, accessAllowed: true };

describe('uncensoredRefusal — the one place an uncensored model is gated', () => {
  it('lets an uncensored model run in an uncensored project with no input', () => {
    expect(uncensoredRefusal(allowed)).toBeNull();
  });

  it('refuses an uncensored model in a standard project, whatever the provider', () => {
    expect(uncensoredRefusal({ ...allowed, mode: ProjectMode.Standard })).toBe(UNCENSORED_REFUSALS.project);
  });

  it('refuses an uncensored model when the workspace has not turned it on', () => {
    expect(uncensoredRefusal({ ...allowed, accessAllowed: false })).toBe(UNCENSORED_REFUSALS.disabled);
  });

  it('refuses an uncensored model that would receive an image, a frame or a reference', () => {
    expect(uncensoredRefusal({ ...allowed, carriesInputs: true })).toBe(UNCENSORED_REFUSALS.inputs);
  });

  it('never gates a standard model', () => {
    expect(uncensoredRefusal({ uncensored: false, mode: ProjectMode.Standard, carriesInputs: true, accessAllowed: false })).toBeNull();
  });
});
