import { describe, expect, it } from 'vitest';
import { FRAMEWORKS, LEAD_AGENTS, LEAD_EDITORS } from './works-with';

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

  it('lists the tested frameworks with an icon', () => {
    const names = FRAMEWORKS.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['nuxt', 'react router', 'astro', 'vite']));
    for (const f of FRAMEWORKS) {
      expect(f.icon).toContain('<svg');
    }
  });
});
