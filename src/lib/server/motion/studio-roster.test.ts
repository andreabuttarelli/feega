import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { CutAnswer, cutAnswer } from '$lib/motion/cut-review';
import { OPUS, REVIEWED, STUDIO_ROSTER, StudioRole, WritesCode, roleBudgetUsd, roleModel, roleTools, turnRole } from './studio-roster';
import { DESCRIBE_FRAMES, VIEW_FRAMES } from './frames';
import { Looks } from './look';

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

  it('the shot builder can read and place library templates: sections come first (eval: it could not, and built 0)', () => {
    const tools = ['list_templates', 'get_template', 'add_template', 'set_template_fields', 'detach_template'];

    expect(roleTools(StudioRole.ShotBuilder, tools)).toEqual(['list_templates', 'get_template', 'add_template', 'set_template_fields']);
  });

  it('a scripted video with nothing built yet goes to the shot builder: library shots only, no free code', () => {
    const shotNames = [...names, 'add_shot', 'list_shots', 'write_component', 'update_components'];

    expect(turnRole('go', scripted)).toBe(StudioRole.ShotBuilder);
    expect(roleTools(StudioRole.ShotBuilder, shotNames)).toEqual(expect.arrayContaining(['add_shot', 'list_shots', 'recreate_ui', 'add_music', 'view_frames']));
    expect(roleTools(StudioRole.ShotBuilder, shotNames)).not.toEqual(expect.arrayContaining(['write_component']));
    expect(roleTools(StudioRole.ShotBuilder, shotNames)).not.toContain('add_clip');
    expect(roleTools(StudioRole.ShotBuilder, ['mark_story'])).toEqual(['mark_story']);
    expect(REVIEWED.has(StudioRole.ShotBuilder)).toBe(true);
    expect(REVIEWED.has(StudioRole.Fixer)).toBe(false);
  });

  it('once there is a cut, the builder takes every tool', () => {
    expect(turnRole('make it pop', built)).toBe(StudioRole.Builder);
    expect(roleTools(StudioRole.Builder, names)).toEqual(names);
  });

  it('a turn applying the critic notes is a fixer, on a smaller budget', () => {
    expect(turnRole(cutAnswer(CutAnswer.Apply, ['2s: empty']), built)).toBe(StudioRole.Fixer);
    expect(roleBudgetUsd(StudioRole.Fixer, 1.5)).toBeLessThan(roleBudgetUsd(StudioRole.Builder, 1.5));
  });

  it.each(Object.values(StudioRole))('%s declares whether it looks, and a role that views frames can also describe them (v7: shots viewed, could not describe, every edit refused)', (role) => {
    const eyes = roleTools(role, [VIEW_FRAMES, DESCRIBE_FRAMES]);

    expect(eyes).toEqual(STUDIO_ROSTER[role].looks === Looks.Describes ? [VIEW_FRAMES, DESCRIBE_FRAMES] : []);
  });

  it('the viewer only looks: it gets no tool', () => {
    expect(roleTools(StudioRole.Viewer, names)).toEqual([]);
  });

  it('the builder, its critic and the viewer share one turn cap without exceeding it', () => {
    expect(STUDIO_ROSTER[StudioRole.Builder].budgetShare + STUDIO_ROSTER[StudioRole.Critic].budgetShare + STUDIO_ROSTER[StudioRole.Viewer].budgetShare).toBeCloseTo(1);
    Object.values(STUDIO_ROSTER).forEach((r) => expect(r.budgetShare).toBeLessThanOrEqual(1));
  });

  it('every role that writes code runs on Opus, never a smaller model', () => {
    const coders = Object.values(StudioRole).filter((r) => STUDIO_ROSTER[r].code === WritesCode.Yes);

    expect(coders).toEqual([StudioRole.Builder, StudioRole.Fixer]);
    coders.forEach((r) => expect(roleModel(r, 'some/vision-model')).toBe(OPUS));
  });

  it('the copywriter writes on Opus; the critic may look with another model', () => {
    expect(roleModel(StudioRole.Copywriter, 'v/m')).toBe(OPUS);
    expect(roleModel(StudioRole.Critic, 'v/m')).toBe('v/m');
  });
});
