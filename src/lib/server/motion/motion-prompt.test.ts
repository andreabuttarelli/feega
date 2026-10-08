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
