import { describe, expect, it } from 'vitest';
import { ElementState } from '@feega/live-edit/element-state';
import { ROWS } from './controls';
import { badgeOf, changedKeys, isChanged, switchStates } from './states';

const DEFAULT = { color: 'rgb(0, 0, 0)', 'background-color': 'rgb(255, 255, 255)', 'padding-top': '8px', 'padding-right': '8px', 'padding-bottom': '8px', 'padding-left': '8px', opacity: '1' };

describe('what a state changes against the default', () => {
  it('names the rows whose value differs', () => {
    const keys = changedKeys(ROWS, { ...DEFAULT, 'background-color': 'rgb(255, 0, 0)' }, DEFAULT);

    expect(keys.has('fill')).toBe(true);
    expect(keys.has('color')).toBe(false);
  });

  it('marks the section and the side group of a changed row', () => {
    const keys = changedKeys(ROWS, { ...DEFAULT, 'padding-left': '16px' }, DEFAULT);

    expect(isChanged(keys, 'padding')).toBe(true);
    expect(isChanged(keys, 'Spacing')).toBe(true);
    expect(isChanged(keys, 'margin')).toBe(false);
  });

  it('flags the row of the property that changed', () => {
    const keys = changedKeys(ROWS, { ...DEFAULT, 'font-size': '20px' }, { ...DEFAULT, 'font-size': '16px' });

    expect(isChanged(keys, 'font-size')).toBe(true);
    expect(isChanged(keys, 'line-height')).toBe(false);
  });

  it('marks nothing without a baseline', () => {
    expect(changedKeys(ROWS, DEFAULT, null).size).toBe(0);
  });
});

describe('the state switcher', () => {
  it('offers disabled only on form controls', () => {
    expect(switchStates('button')).toContain(ElementState.Disabled);
    expect(switchStates('div')).not.toContain(ElementState.Disabled);
  });

  it('starts with default', () => {
    expect(switchStates('a')[0]).toBe(ElementState.Default);
  });
});

describe('the state badge', () => {
  it('is the pseudo class of the state and nothing for default', () => {
    expect(badgeOf(ElementState.FocusVisible)).toBe(':focus-visible');
    expect(badgeOf(ElementState.Default)).toBe('');
  });
});
