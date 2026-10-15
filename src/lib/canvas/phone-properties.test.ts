import { describe, expect, it } from 'vitest';
import { editingLabel, targetOf } from './phone-properties';

const rows = [
  { id: 'f', type: 'motion', displayName: 'Hero' },
  { id: 'g', type: 'motion', displayName: null },
  { id: 't', type: 'text', displayName: 'Note' }
];

describe('the Properties target on a phone', () => {
  it('is the one selected frame, element or group', () => {
    expect(targetOf(['f'], rows)).toEqual({ id: 'f', name: 'Hero' });
  });

  it('names an unnamed frame', () => {
    expect(targetOf(['g'], rows)).toEqual({ id: 'g', name: 'Frame' });
  });

  it('is nothing with no selection, several, or a node without properties', () => {
    expect(targetOf([], rows)).toBeNull();
    expect(targetOf(['f', 'g'], rows)).toBeNull();
    expect(targetOf(['t'], rows)).toBeNull();
  });

  it('labels the chat chip', () => {
    expect(editingLabel('Hero')).toBe('Editing: Hero');
  });
});
