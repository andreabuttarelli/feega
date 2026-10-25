import { describe, expect, it } from 'vitest';
import { reflowProblems, type BoxShot } from './reflow';

const still = { own: '' };
const shot = (time: number, boxes: BoxShot['boxes']): BoxShot => ({ time, boxes });

describe('reflow during an entrance', () => {
  it('flags a box that moves while nothing of its own changed: an entrance grew the layout around it', () => {
    const shots = [
      shot(0.9, { 'div.title': { top: 400, ...still }, 'div.btn': { top: 0, own: 'display:none' } }),
      shot(1.5, { 'div.title': { top: 368, ...still }, 'div.btn': { top: 520, own: 'display:flex' } })
    ];

    expect(reflowProblems(shots)).toEqual([
      'div.title moves 32px at 1.5s without a tween of its own: something next to it changes size, display or margin. Animate entrances with transform and opacity only, and keep the final layout from frame 0'
    ]);
  });

  it('leaves alone a box that moves because its own layout style is animated, and boxes that hold still', () => {
    const shots = [
      shot(0, { 'div.a': { top: 10, own: 'top:10px' }, 'div.b': { top: 50, ...still } }),
      shot(1, { 'div.a': { top: 90, own: 'top:90px' }, 'div.b': { top: 50, ...still } })
    ];

    expect(reflowProblems(shots)).toEqual([]);
  });

  it('reads the shots in time order, whatever order the check visited them in', () => {
    const shots = [shot(2, { 'p.x': { top: 5, ...still } }), shot(1, { 'p.x': { top: 5, ...still } }), shot(1, { 'p.x': { top: 5, ...still } })];

    expect(reflowProblems(shots)).toEqual([]);
  });
});
