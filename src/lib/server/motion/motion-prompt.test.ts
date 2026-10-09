import { describe, expect, it } from 'vitest';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { TITLE_CARD_RULE, UI_FOCUS_RULE } from '$lib/motion/style';
import { MotionStyle } from '$lib/motion/style-model';

const prompt = (style: MotionStyle) =>
  motionAgentPrompt({
    brandName: null,
    selectionNote: '',
    vision: Vision.Available,
    style
  });

describe('when the agent breaks the video', () => {
  it('restores a saved version itself instead of asking the user to undo', () => {
    expect(prompt(MotionStyle.LaunchFilm)).toMatch(/restore_revision/);
    expect(prompt(MotionStyle.LaunchFilm)).toMatch(/never ask the user to undo/i);
  });
});

describe('the motion agent keeps titles and scenes apart', () => {
  it.each([MotionStyle.LaunchFilm, MotionStyle.AppleMinimal])('%s carries the title card rule', (style) => {
    expect(prompt(style)).toContain(TITLE_CARD_RULE);
  });

  it.each([MotionStyle.LaunchFilm, MotionStyle.AppleMinimal, MotionStyle.UiMorph])('%s carries the UI focus rule', (style) => {
    expect(prompt(style)).toContain(UI_FOCUS_RULE);
  });

  it('shows the UI focus rule with the prompt field example, one part per beat', () => {
    expect(UI_FOCUS_RULE).toMatch(/text field and the typed text → the button being pressed → the progress bar alone → the result/);
    expect(UI_FOCUS_RULE).toContain('focus_ui');
  });

  it('writes product acts as a sequence of UI beats', () => {
    expect(prompt(MotionStyle.LaunchFilm)).toMatch(/product act is a sequence of UI beats/);
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

