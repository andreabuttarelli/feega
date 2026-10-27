import { describe, expect, it } from 'vitest';
import { FieldType } from './field-model';
import { KEY_FIELDS_MAX, keyFieldsSchema, splitFields } from './key-fields';

const field = (key: string, type = FieldType.Text) => ({ key, type });

describe('key fields split a template into what a user edits and what is advanced', () => {
  it('shows the declared keys first, in the declared order', () => {
    const fields = [field('speed', FieldType.Number), field('headline'), field('accent', FieldType.Color)];

    const split = splitFields(fields, ['accent', 'headline']);

    expect(split.key.map((f) => f.key)).toEqual(['accent', 'headline']);
    expect(split.advanced.map((f) => f.key)).toEqual(['speed']);
  });

  it('ignores a declared key the template does not have', () => {
    expect(splitFields([field('headline')], ['gone', 'headline']).key.map((f) => f.key)).toEqual(['headline']);
  });

  it('guesses the first everyday fields when nothing is declared', () => {
    const fields = [field('speed', FieldType.Number), field('a'), field('tint', FieldType.Color), field('b'), field('c')];

    expect(splitFields(fields, undefined).key.map((f) => f.key)).toEqual(['a', 'tint', 'b']);
  });

  it(`refuses more than ${KEY_FIELDS_MAX} key fields`, () => {
    expect(keyFieldsSchema.safeParse(['a', 'b', 'c', 'd', 'e', 'f']).success).toBe(false);
  });
});
