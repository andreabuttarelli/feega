import { describe, expect, it } from 'vitest';
import { ControlKind } from './prop-controls';
import { propTally } from './focus-usage';

describe('propTally', () => {
  it('counts changes per control kind and nothing else', () => {
    const tally = propTally();
    tally.add(ControlKind.Select);
    tally.add(ControlKind.Select);
    tally.add(ControlKind.Toggle);

    expect(tally.drain()).toEqual([
      { control: ControlKind.Select, prop_count: 2 },
      { control: ControlKind.Toggle, prop_count: 1 }
    ]);
  });

  it('starts empty again after it is drained', () => {
    const tally = propTally();
    tally.add(ControlKind.Text);
    tally.drain();

    expect(tally.drain()).toEqual([]);
  });
});
