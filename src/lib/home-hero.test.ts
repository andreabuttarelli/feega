import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERO_BACKDROP, backdropPlays } from './home-hero';

const PLAYING = { reducedMotion: false, saveData: false, tabVisible: true, inView: true };

describe('the home hero backdrop', () => {
  it('plays only when nothing asks it to stay still', () => {
    expect(backdropPlays(PLAYING)).toBe(true);
  });

  it.each([['reducedMotion', true], ['saveData', true], ['tabVisible', false], ['inView', false]] as const)('stays on its poster when %s is %s', (key, value) => {
    expect(backdropPlays({ ...PLAYING, [key]: value })).toBe(false);
  });

  it('is a text-free loop cut from the flow-lines composition of our library, with its poster', () => {
    expect(existsSync(`static${HERO_BACKDROP.poster}`)).toBe(true);
    expect(existsSync(`static${HERO_BACKDROP.video}`)).toBe(true);
  });
});
