import { describe, expect, it } from 'vitest';
import { techniqueFace } from './technique-face';

const view = { name: 'logo-flow', version: 3, inputs: 2, outputs: 1, ranVersion: 3 };

describe('techniqueFace', () => {
  it('shows the live version and the declared ports', () => {
    const face = techniqueFace('logo-flow', view);

    expect(face.pills).toEqual(['v3']);
    expect(face.text).toBe('logo-flow\n2 inputs, 1 output');
  });

  it('says the last run used an older version than the definition', () => {
    const face = techniqueFace('logo-flow', { ...view, version: 4 });

    expect(face.pills).toEqual(['v4', 'Out of date']);
  });

  it('names a technique that was deleted', () => {
    const face = techniqueFace('logo-flow', null);

    expect(face.text).toBe('logo-flow\nThe technique was deleted');
  });
});
