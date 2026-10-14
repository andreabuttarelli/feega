import { describe, expect, it } from 'vitest';
import { PropertiesView, propertiesFor } from './properties-view';

describe('what Properties shows for the selection', () => {
  it('the frame itself when nothing inside it is selected: format, length, frame rate, background, fields', () => {
    expect(propertiesFor({ clip: null, part: null })).toBe(PropertiesView.Frame);
  });

  it('the clip when a clip is selected', () => {
    expect(propertiesFor({ clip: 'c1', part: null })).toBe(PropertiesView.Clip);
  });

  it('only the part field when a poster part is selected', () => {
    expect(propertiesFor({ clip: 'c1', part: 'lines:0' })).toBe(PropertiesView.Part);
  });
});
