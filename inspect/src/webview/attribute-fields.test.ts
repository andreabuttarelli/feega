import { describe, expect, it } from 'vitest';
import { editableAttributes, attributeLabel } from './attribute-fields';

describe('editableAttributes', () => {
  it('keeps data attributes and content attributes, in page order', () => {
    const shown = editableAttributes([
      { name: 'class', value: 'a' },
      { name: 'data-speed', value: '0.9' },
      { name: 'src', value: '/a.jpg' },
      { name: 'onclick', value: 'x()' },
      { name: 'alt', value: 'A' }
    ]);

    expect(shown.map((a) => a.name)).toEqual(['data-speed', 'src', 'alt']);
  });

  it('is empty when the element has no attributes', () => {
    expect(editableAttributes(undefined)).toEqual([]);
  });
});

describe('attributeLabel', () => {
  it('drops the data prefix and spaces the words', () => {
    expect(attributeLabel('data-hold-ms')).toBe('hold ms');
    expect(attributeLabel('src')).toBe('src');
  });
});
