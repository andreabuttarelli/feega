import { describe, expect, it } from 'vitest';
import { TurnMode } from '$lib/motion/deep';
import { turnMode } from './mode';

const DUB = `make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.

it should be a launch saas video for https://dub.co`;

describe('which requests run as a Deep job', () => {
  it('runs a request to create a video as Deep', () => {
    expect(turnMode({ message: DUB, clips: 0, requested: null })).toBe(TurnMode.Deep);
    expect(turnMode({ message: 'Create a 20 s trailer for allbirds.com', clips: 12, requested: null })).toBe(TurnMode.Deep);
    expect(turnMode({ message: 'build me a launch promo', clips: 0, requested: null })).toBe(TurnMode.Deep);
  });

  it('keeps small edits in the quick chat', () => {
    expect(turnMode({ message: 'make the title bigger', clips: 8, requested: null })).toBe(TurnMode.Quick);
    expect(turnMode({ message: 'change the accent to red', clips: 0, requested: null })).toBe(TurnMode.Quick);
    expect(turnMode({ message: 'add a title that says hello', clips: 0, requested: null })).toBe(TurnMode.Quick);
    expect(turnMode({ message: 'make the video 2 seconds shorter', clips: 10, requested: null })).toBe(TurnMode.Quick);
  });

  it('runs a long brief on an empty video as Deep', () => {
    const brief = 'A calm sequence for our coffee brand: beans falling, the cup, the logo, then the website at the end with a soft piano under it all';
    expect(turnMode({ message: brief, clips: 0, requested: null })).toBe(TurnMode.Deep);
  });

  it('obeys the mode the user picked', () => {
    expect(turnMode({ message: DUB, clips: 0, requested: TurnMode.Quick })).toBe(TurnMode.Quick);
    expect(turnMode({ message: 'make the title bigger', clips: 8, requested: TurnMode.Deep })).toBe(TurnMode.Deep);
  });
});
