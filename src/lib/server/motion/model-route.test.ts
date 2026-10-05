import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { Tier, activeTools, openingTier, selfCheckChoice, spentUsd, stepTier, toolsWritingCode } from './model-route';

describe('the self-check opens on view_frames', () => {
  it('forces view_frames on the edit model without reasoning', () => {
    expect(selfCheckChoice({ tier: Tier.Edit, reasoning: null })).toEqual({ toolChoice: { type: 'tool', toolName: 'view_frames' } });
  });

  it('never forces a tool while reasoning is on: providers refuse tool_choice with thinking and the whole self-check dies', () => {
    expect(selfCheckChoice({ tier: Tier.Edit, reasoning: 'medium' })).toEqual({});
  });

  it('never forces a tool on the code model', () => {
    expect(selfCheckChoice({ tier: Tier.Code, reasoning: null })).toEqual({});
  });
});

const doc = newMotionDoc(MotionFormat.Landscape);

describe('which model a motion step runs on', () => {
  it('keeps a small edit on the cheap model', () => {
    expect(openingTier({ message: 'make the title blue', doc, selection: [] })).toBe(Tier.Edit);
  });

  it('starts on the code model when the user asks for components or animated UI', () => {
    expect(openingTier({ message: 'write a component that shows a chat panel typing', doc, selection: [] })).toBe(Tier.Code);
    expect(openingTier({ message: 'build a 30 s trailer with animated UI scenes', doc, selection: [] })).toBe(Tier.Code);
  });

  it('moves to the code model for the rest of the turn once the agent reads code', () => {
    expect(stepTier(Tier.Edit, [[{ toolName: 'get_motion_doc' }], [{ toolName: 'read_component' }]])).toBe(Tier.Code);
    expect(stepTier(Tier.Edit, [[{ toolName: 'set_props' }]])).toBe(Tier.Edit);
  });

  it('offers the code-writing tools only on the code model', () => {
    const names = ['get_motion_doc', 'write_component', 'patch_component', 'read_component'];

    expect(activeTools(Tier.Edit, names)).toEqual(['get_motion_doc', 'read_component']);
    expect(activeTools(Tier.Code, names)).toEqual(names);
    expect([...toolsWritingCode]).toEqual(['write_component', 'patch_component']);
  });

  it('prices the steps of a turn at each step model rate', () => {
    const rate = (id: string) => (id === 'code' ? { input: 2, cachedInput: 0.2, output: 10 } : { input: 0.1, cachedInput: 0.01, output: 0.5 });
    const usd = spentUsd(
      [
        { inputTokens: 1_000_000, outputTokens: 100_000, cachedTokens: 500_000 },
        { inputTokens: 1_000_000, outputTokens: 0 }
      ],
      ['code', 'edit'],
      rate
    );

    expect(usd).toBeCloseTo(1 + 0.1 + 1 + 0.1, 5);
  });
});
