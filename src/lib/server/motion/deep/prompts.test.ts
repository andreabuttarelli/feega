import { describe, expect, it } from 'vitest';
import { refusedPrompt } from './prompts';

describe('an edit refused on save goes back to the builder', () => {
  it('names every refusal and asks to redo it from the saved video', () => {
    const text = refusedPrompt(['2 edits refused (invalid: comps.x.tracks: a composition holds video tracks only)']);

    expect(text).toContain('a composition holds video tracks only');
    expect(text).toMatch(/redo/);
  });
});
