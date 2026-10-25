// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { unseen } from './off-stage';

const clip = (style: string, className = 'clip') => {
  document.body.innerHTML = `<div class="${className}" style="${style}"><span>hi</span></div>`;
  return document.body.firstElementChild as HTMLElement;
};

describe('unseen', () => {
  it('a clip the player hid at this time is skipped by the capture', () => {
    expect(unseen(clip('visibility:hidden'))).toBe(true);
  });

  it('a clip on screen, and anything that is not a clip, is drawn', () => {
    expect(unseen(clip('visibility:visible'))).toBe(false);
    expect(unseen(clip('visibility:hidden', 'card'))).toBe(false);
    expect(unseen(document.createTextNode('x'))).toBe(false);
  });

  it('a box faded to zero opacity is skipped, so a silent music clip does not hold every frame waiting for a picture nobody sees', () => {
    expect(unseen(clip('opacity:0;position:absolute', 'box'))).toBe(true);
    expect(unseen(clip('opacity:0.01;position:absolute', 'box'))).toBe(false);
  });

  it('a faded box still in the flow is drawn, so the boxes it pushes do not jump when it fades in', () => {
    expect(unseen(clip('opacity:0;position:static', 'btn'))).toBe(false);
    expect(unseen(clip('opacity:0;position:relative', 'btn'))).toBe(false);
    expect(unseen(clip('opacity:0;position:absolute', 'box'))).toBe(true);
  });
});
