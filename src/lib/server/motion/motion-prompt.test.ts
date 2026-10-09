import { describe, expect, it } from 'vitest';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { HOUSE_DEFAULTS, STYLES, TITLE_CARD_RULE, TITLE_TYPE_RULE, UI_FOCUS_RULE } from '$lib/motion/style';
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

  it.each([MotionStyle.LaunchFilm, MotionStyle.AppleMinimal])('%s carries the title type rule', (style) => {
    expect(prompt(style)).toContain(TITLE_TYPE_RULE);
    expect(TITLE_TYPE_RULE).toMatch(/600/);
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


describe('a style the user asks for beats the house defaults', () => {
  it('the graphic poster style forbids none of the house defaults', () => {
    expect(STYLES[MotionStyle.Graphic].forbidden.filter((f) => HOUSE_DEFAULTS.includes(f))).toEqual([]);
  });

  it('every prompt says the house defaults yield to an asked style or references, and the hard rules do not', () => {
    for (const style of Object.values(MotionStyle)) {
      expect(prompt(style)).toContain('House defaults yield');
      expect(prompt(style)).toContain(HOUSE_DEFAULTS[0]);
    }
  });
});

describe('references become measurable targets before the build', () => {
  it('every prompt asks to record the reference look before building', () => {
    for (const style of Object.values(MotionStyle)) {
      expect(prompt(style)).toContain('set_reference_look');
    }
  });

  it('every prompt asks to measure the typography of each role from the picture', () => {
    for (const style of Object.values(MotionStyle)) {
      for (const detail of ['per role', 'weight', 'tracking', 'line height', 'case', 'cap height']) {
        expect(prompt(style)).toContain(detail);
      }
    }
  });

  it('the graphic poster prompt names concrete poster moves', () => {
    const text = prompt(MotionStyle.Graphic);

    for (const move of ['cropped by the frame', 'columns', 'rule']) {
      expect(text).toContain(move);
    }
  });
});
