import { describe, expect, it } from 'vitest';
import { ProjectMode, modeOf } from './project-mode';

describe('project mode', () => {
  it('a missing or unknown mode is standard', () => {
    expect(modeOf(undefined)).toBe(ProjectMode.Standard);
    expect(modeOf('weird')).toBe(ProjectMode.Standard);
    expect(modeOf('uncensored')).toBe(ProjectMode.Uncensored);
  });
});
