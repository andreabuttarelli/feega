import { describe, expect, it } from 'vitest';
import { VIEWER_MODEL, viewFrames, viewNote, type ViewerAsk } from './viewer';
import { STUDIO_ROSTER, StudioRole } from './studio-roster';

const frames = [1, 2.5].map((time) => ({ time, bytes: Buffer.from(`frame ${time}`) }));

const asked = (answer: unknown) => {
  const seen: ViewerAsk[] = [];
  return { seen, ask: async (q: ViewerAsk) => (seen.push(q), { answer, usd: 0.01 }) };
};

describe('the viewer', () => {
  it('sees only the frames: one image each, no gate, no doc, no brief', async () => {
    const { seen, ask } = asked({ frames: [] });
    await viewFrames({ ask }, frames);

    expect(seen[0].images).toHaveLength(2);
    expect(seen[0].prompt).not.toMatch(/gate|blocking|quality|script/i);
    expect(seen[0].prompt).toContain('1s, 2.5s');
  });

  it('runs on a Sonnet with vision, under its own label', () => {
    expect(VIEWER_MODEL).toMatch(/claude-sonnet/);
    expect(STUDIO_ROSTER[StudioRole.Viewer].label).toBe('motion-viewer');
  });

  it('returns one line per frame with what is visible and what is wrong', async () => {
    const lines = [
      { time: 1, visible: 'black word "Ship" centred on cream', wrong: 'nothing' },
      { time: 2.5, visible: 'a white rectangle fills half the frame', wrong: 'the screen picture has not loaded' }
    ];
    const out = await viewFrames(asked({ frames: lines }), frames);

    expect(out.lines).toEqual(lines);
    expect(out.usd).toBe(0.01);
    expect(viewNote(lines)).toContain('2.5s: a white rectangle fills half the frame. Wrong: the screen picture has not loaded');
  });

  it('an answer that is not a frame list is no description, never a guess', async () => {
    expect((await viewFrames(asked('looks great'), frames)).lines).toBeNull();
  });
});
