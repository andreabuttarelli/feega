import { describe, expect, it } from 'vitest';
import { FieldType, coerceValue, type ExposedField } from './fields';
import { changedRaw, rawOf } from './raw-values';

const field = (type: FieldType, extra: Partial<ExposedField> = {}): ExposedField => ({ key: 'k', label: 'K', type, clipId: 'c', prop: 'p', default: null, ...extra });

describe('a field value written back as the text a template accepts', () => {
  it('round-trips every kind of field through coerceValue', () => {
    const cases: [ExposedField, unknown][] = [
      [field(FieldType.Text), 'hello'],
      [field(FieldType.Number, { min: 0, max: 10 }), 4],
      [field(FieldType.Color), '#ff0000'],
      [field(FieldType.Asset), 'asset-1'],
      [field(FieldType.Asset), 'https://cdn.test/a.jpg'],
      [field(FieldType.Boolean), false],
      [field(FieldType.Select, { options: ['a', 'b'] }), 'b'],
      [field(FieldType.MediaList), [{ assetId: 'a', kind: 'image' }, { assetId: 'b', kind: 'video', aspect: '4:5', fit: 'contain' }]]
    ];
    for (const [f, value] of cases) {
      const back = coerceValue(f, rawOf(f, value));
      expect(back.ok && back.value).toEqual(value);
    }
  });

  it('sends only what the person changed', () => {
    const fresh = [{ ...field(FieldType.Asset), key: 'photo', value: '' }, { ...field(FieldType.Text), key: 'name', value: 'Shoe' }];
    const edited = [{ ...fresh[0], value: 'new-id' }, fresh[1]];
    expect(changedRaw(fresh, edited)).toEqual({ photo: 'new-id' });
  });
});
