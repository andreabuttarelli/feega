import { describe, expect, it } from 'vitest';
import { Landing, frameName, unlandedNotice } from './unlanded-frames';

describe('the notice for frames that did not land', () => {
  it('says nothing when every frame landed', () => {
    expect(unlandedNotice(Landing.Imported, [])).toBeNull();
  });

  it('counts and names the frames left out', () => {
    expect(unlandedNotice(Landing.Imported, ['Broken'])).toBe('1 frame could not be imported: Broken');
    expect(unlandedNotice(Landing.Restored, ['Intro', 'Outro'])).toBe('2 frames could not be restored: Intro, Outro');
  });

  it('names a frame without a name', () => {
    expect(frameName(null)).toBe('Untitled frame');
    expect(frameName('Intro')).toBe('Intro');
  });
});
