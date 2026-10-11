// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { offStageClip } from './off-stage';

const clip = (style: string, className = 'clip') => {
  document.body.innerHTML = `<div class="${className}" style="${style}"><span>hi</span></div>`;
  return document.body.firstElementChild as HTMLElement;
};

describe('offStageClip', () => {
  it('a clip the player hid at this time is skipped by the capture', () => {
    expect(offStageClip(clip('visibility:hidden'))).toBe(true);
  });

  it('a clip on screen, and anything that is not a clip, is drawn', () => {
    expect(offStageClip(clip('visibility:visible'))).toBe(false);
    expect(offStageClip(clip('visibility:hidden', 'card'))).toBe(false);
    expect(offStageClip(document.createTextNode('x'))).toBe(false);
  });
});
