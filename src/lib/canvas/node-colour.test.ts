import { describe, expect, it } from 'vitest';
import { COLOUR_TAGS, colourOf, withColour } from './node-colour';
import { validateNodeData, validateNodeDataUpdate } from './node-data';

describe('colour tags', () => {
  it('reads a known tag and ignores anything else', () => {
    expect(colourOf({ colorTag: 'red' })).toBe('red');
    expect(colourOf({ colorTag: 'plaid' })).toBeNull();
    expect(colourOf({})).toBeNull();
  });

  it('offers a fixed palette', () => {
    expect(COLOUR_TAGS.length).toBeGreaterThan(3);
  });

  it('clears a tag with null', () => {
    expect(withColour(null)).toEqual({ colorTag: null });
  });

  it('a text node keeps its tag through validation', () => {
    const verdict = validateNodeData('text', { prompt: 'hi', colorTag: 'blue' });
    expect(verdict).toEqual({ ok: true, data: expect.objectContaining({ colorTag: 'blue' }) });
  });

  it('an update may set the tag on any node type', () => {
    expect(validateNodeDataUpdate('image', { prompt: 'x' }, { colorTag: 'green' }).ok).toBe(true);
  });

  it('an unknown tag is refused', () => {
    expect(validateNodeData('text', { prompt: 'hi', colorTag: 'plaid' }).ok).toBe(false);
  });
});
