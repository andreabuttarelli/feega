import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { CutAnswer, cutAnswer } from '$lib/motion/cut-review';
import { STUDIO_ROSTER, StudioRole, roleBudgetUsd, roleTools, turnRole } from './studio-roster';

const empty = newMotionDoc(MotionFormat.Landscape);
const scripted = { ...empty, script: { research: {}, acts: [] } } as never;
const built = { ...empty, tracks: [{ id: 't', kind: 'visual', name: 'V', clips: [{ id: 'c' }] }] } as never;
const names = ['analyze_site', 'write_script', 'web_search', 'recreate_ui', 'add_clip', 'add_music', 'view_frames'];

describe('the studio roster', () => {
  it('a blank video starts with the director: research, references, script and storyboard', () => {
    expect(turnRole('a trailer for linear.app', empty)).toBe(StudioRole.Director);
    expect(turnRole('add a title that says Pop', empty)).toBe(StudioRole.Builder);
    expect(roleTools(StudioRole.Director, names)).toEqual(['analyze_site', 'write_script', 'web_search', 'recreate_ui']);
  });

  it('once there is a script or a cut, the builder takes every tool', () => {
    expect(turnRole('go', scripted)).toBe(StudioRole.Builder);
    expect(turnRole('make it pop', built)).toBe(StudioRole.Builder);
    expect(roleTools(StudioRole.Builder, names)).toEqual(names);
  });

  it('a turn applying the critic notes is a fixer, on a smaller budget', () => {
    expect(turnRole(cutAnswer(CutAnswer.Apply, ['2s: empty']), built)).toBe(StudioRole.Fixer);
    expect(roleBudgetUsd(StudioRole.Fixer, 1.5)).toBeLessThan(roleBudgetUsd(StudioRole.Builder, 1.5));
  });

  it('the builder and its critic share one turn cap without exceeding it', () => {
    expect(STUDIO_ROSTER[StudioRole.Builder].budgetShare + STUDIO_ROSTER[StudioRole.Critic].budgetShare).toBeCloseTo(1);
    Object.values(STUDIO_ROSTER).forEach((r) => expect(r.budgetShare).toBeLessThanOrEqual(1));
  });
});
