import { describe, expect, it } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { UncensoredLock } from '$lib/uncensored-lock';
import { modeSwitchRefusal, NOT_SHAREABLE, OUTPUTS_PRESENT } from './mode-switch';

const open = { lock: UncensoredLock.Open, hasOutputs: false, hasShares: false };

describe('which way a project may switch mode', () => {
  it.each([
    { to: ProjectMode.Uncensored, facts: open, refusal: null },
    { to: ProjectMode.Uncensored, facts: { ...open, lock: UncensoredLock.AgeUnverified }, refusal: UncensoredLock.AgeUnverified },
    { to: ProjectMode.Uncensored, facts: { ...open, lock: UncensoredLock.PlanNotEntitled }, refusal: UncensoredLock.PlanNotEntitled },
    { to: ProjectMode.Uncensored, facts: { ...open, hasShares: true }, refusal: NOT_SHAREABLE },
    { to: ProjectMode.Standard, facts: open, refusal: null },
    { to: ProjectMode.Standard, facts: { ...open, lock: UncensoredLock.AgeUnverified }, refusal: null },
    { to: ProjectMode.Standard, facts: { ...open, hasOutputs: true }, refusal: OUTPUTS_PRESENT }
  ])('to $to with $facts → $refusal', ({ to, facts, refusal }) => {
    expect(modeSwitchRefusal(to, facts)).toBe(refusal);
  });
});
