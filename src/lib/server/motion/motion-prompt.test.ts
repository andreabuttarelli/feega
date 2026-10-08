import { describe, expect, it } from 'vitest';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { TITLE_CARD_RULE } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';

const prompt = (style: MotionStyle) =>
  motionAgentPrompt({
    brandName: null,
    selectionNote: '',
    vision: Vision.Available,
    style
  });

describe('the motion agent keeps titles and scenes apart', () => {
  it.each([MotionStyle.LaunchFilm, MotionStyle.AppleMinimal])('%s carries the title card rule', (style) => {
    expect(prompt(style)).toContain(TITLE_CARD_RULE);
  });

  it('the trailer structure alternates title cards and scenes', () => {
    expect(prompt(MotionStyle.LaunchFilm)).toMatch(/title card → scene → title card/);
  });
});

describe('live components', () => {
  const text = prompt(MotionStyle.LaunchFilm);

  it('says when to pick live and that the video shows a still', () => {
    expect(text).toContain('mode "live"');
    expect(text).toMatch(/games, generative pieces that should differ on every view, interactive heroes/);
    expect(text).toContain('the video shows a still');
  });

  it.each(['LittleJS.engineInit(', 'kaplay(', 'p5((p) =>', 'input.keys', 'still(t)'])('shows the pattern %s', (pattern) => {
    expect(text).toContain(pattern);
  });
});

