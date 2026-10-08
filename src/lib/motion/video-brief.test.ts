import { describe, expect, it } from 'vitest';
import { BRIEF_PARAM, BRIEF_TEMPLATES, briefEditorPath, briefName } from './video-brief';

describe('a brief typed on /app names its video and travels to the editor', () => {
  it('a URL names the video after its host', () => {
    expect(briefName('https://www.acme.com/pricing')).toBe('acme.com');
  });

  it('a description names the video after its first words', () => {
    expect(briefName('A launch teaser for our new running shoe, bold and fast')).toBe('A launch teaser for our new');
  });

  it('an empty brief keeps the default name', () => {
    expect(briefName('   ')).toBe('Untitled video');
  });

  it('the editor path carries the brief so the chat can send it', () => {
    const path = briefEditorPath({ projectId: 'p1', canvasId: 'c1', nodeId: 'n1' }, 'https://acme.com');
    expect(path).toBe(`/p/p1/c/c1/motion/n1?${BRIEF_PARAM}=https%3A%2F%2Facme.com`);
  });

  it('every template is a brief ready to send', () => {
    expect(BRIEF_TEMPLATES.every((t) => t.brief.length > 0 && t.name.length > 0)).toBe(true);
  });
});
