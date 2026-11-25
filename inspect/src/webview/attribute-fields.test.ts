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

  it('offers the values an element lists in data-<name>-options, and hides that list', () => {
    const shown = editableAttributes([
      { name: 'data-preset', value: 'trans' },
      { name: 'data-preset-options', value: 'rainbow, trans,custom' },
      { name: 'data-speed', value: '1' }
    ]);

    expect(shown).toEqual([
      { name: 'data-preset', value: 'trans', options: ['rainbow', 'trans', 'custom'] },
      { name: 'data-speed', value: '1', options: [] }
    ]);
  });

  it('keeps the current value among the options when the list misses it', () => {
    const [field] = editableAttributes([
      { name: 'data-fade', value: 'soft' },
      { name: 'data-fade-options', value: 'on,off' }
    ]);

    expect(field.options).toEqual(['soft', 'on', 'off']);
  });

  it('is empty when the element has no attributes', () => {
    expect(editableAttributes(undefined)).toEqual([]);
  });
});

describe('attributeLabel', () => {
  it('drops the data prefix and spaces the words', () => {
    expect(attributeLabel('data-hold-ms')).toBe('hold ms');
    expect(attributeLabel('src')).toBe('src');
    expect(attributeLabel('--ascii-c1')).toBe('ascii c1');
  });
});
