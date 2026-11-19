import { describe, expect, it } from 'vitest';
import { LEAD_AGENTS, LEAD_EDITORS } from './works-with';

describe('hero lead chips', () => {
  it('names the four lead agents in order', () => {
    expect(LEAD_AGENTS.map((a) => a.name)).toEqual(['ChatGPT', 'Claude', 'Gemini', 'OpenCode']);
  });

  it('gives every agent an 18px inline svg', () => {
    for (const a of LEAD_AGENTS) {
      expect(a.icon).toContain('width="18"');
    }
  });

  it('keeps the three editors', () => {
    expect(LEAD_EDITORS.map((e) => e.name)).toEqual(['VS Code', 'Cursor', 'Windsurf']);
  });
});
