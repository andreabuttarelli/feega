import { describe, expect, it } from 'vitest';
import type { ComponentRow } from '../host/component-list';
import { Badge, type Controls } from './canvas-card';
import { FieldKind, badgeOf, bestExample, displayOf, fieldsOf, loadedFrom, parseField, propsFor, savedOf, withEdit } from './component-props';

const example = (line: number, props: Record<string, unknown>, unresolved: string[] = []) => ({ id: `src/p.svelte:${line}`, file: 'src/p.svelte', line, props, unresolved }) as ComponentRow['examples'][number];

const row = (examples: ComponentRow['examples']): ComponentRow => ({ name: 'Card', file: 'src/Card.svelte', folder: '', uses: examples.length, examples });

describe('bestExample', () => {
  it('takes the one the user picked', () => {
    const rows = row([example(1, { a: 1 }), example(2, { a: 2 })]);

    expect(bestExample(rows, 'src/p.svelte:2')?.line).toBe(2);
  });

  it('otherwise takes the one with the fewest props left to fill, the first on a tie', () => {
    const rows = row([example(1, {}, ['a', 'b']), example(2, { a: 1 }, ['b']), example(3, { a: 1 }, ['b'])]);

    expect(bestExample(rows, undefined)?.line).toBe(2);
  });

  it('forgets a picked example that no longer exists', () => {
    expect(bestExample(row([example(1, {})]), 'src/gone.svelte:9')?.line).toBe(1);
  });

  it('is null when the component is not used', () => {
    expect(bestExample(row([]), undefined)).toBeNull();
  });
});

describe('propsFor', () => {
  it('lays the edited props over the ones the code gave', () => {
    const rows = row([example(1, { title: 'A', n: 1 })]);

    expect(propsFor(rows, undefined, { title: 'B' })).toEqual({ title: 'B', n: 1 });
  });

  it('is only the edits when the component is not used', () => {
    expect(propsFor(row([]), undefined, { n: 2 })).toEqual({ n: 2 });
  });
});

const controls: Controls = [
  { name: 'title', kind: 'text', required: true },
  { name: 'n', kind: 'number', required: false, default: 3 },
  { name: 'items', kind: 'array', required: false },
  { name: 'open', kind: 'toggle', required: false }
];

describe('fieldsOf', () => {
  it('offers a field for every prop the chosen example could not resolve, prefilled with what the code gave elsewhere', () => {
    const rows = row([example(1, { n: 5 }, ['title', 'items'])]);

    expect(fieldsOf(rows, undefined, {}, controls).map((f) => [f.name, f.kind, f.value])).toEqual([
      ['title', FieldKind.Text, 'title'],
      ['items', FieldKind.Json, '[]']
    ]);
  });

  it('offers every declared prop when the component is not used', () => {
    expect(fieldsOf(row([]), undefined, {}, controls).map((f) => f.name)).toEqual(['title', 'n', 'items', 'open']);
  });

  it('shows an edited value over the placeholder', () => {
    const rows = row([example(1, {}, ['title'])]);

    expect(fieldsOf(rows, undefined, { title: 'Mine' }, controls)[0]).toMatchObject({ name: 'title', value: 'Mine', edited: true });
  });

  it('keeps the field of an edited prop that the example resolved', () => {
    const rows = row([example(1, { n: 1 }, ['title'])]);

    expect(fieldsOf(rows, undefined, { n: 9 }, controls).map((f) => f.name)).toEqual(['title', 'n']);
  });

  it('has no field for a fully resolved example', () => {
    expect(fieldsOf(row([example(1, { title: 'A' })]), undefined, {}, controls)).toEqual([]);
  });

  it('falls back to the names of the unresolved props when the declared ones are not known', () => {
    expect(fieldsOf(row([example(1, {}, ['quiz'])]), undefined, {}, null).map((f) => [f.name, f.value])).toEqual([['quiz', 'quiz']]);
  });
});

describe('parseField', () => {
  it('reads each kind of field the way it is typed', () => {
    expect(parseField('12', FieldKind.Number)).toBe(12);
    expect(parseField('true', FieldKind.Toggle)).toBe(true);
    expect(parseField('{"a":1}', FieldKind.Json)).toEqual({ a: 1 });
    expect(parseField('hello', FieldKind.Text)).toBe('hello');
  });

  it('reads an object or array typed into a text field, since its declared type may be one the types do not describe', () => {
    expect(parseField('{"a":1}', FieldKind.Text)).toEqual({ a: 1 });
    expect(parseField('[1,2]', FieldKind.Text)).toEqual([1, 2]);
    expect(parseField('{not json', FieldKind.Text)).toBe('{not json');
    expect(parseField('plain', FieldKind.Text)).toBe('plain');
  });

  it('keeps the text of a number or json that does not parse', () => {
    expect(parseField('abc', FieldKind.Number)).toBe('abc');
    expect(parseField('{oops', FieldKind.Json)).toBe('{oops');
  });
});

describe('displayOf', () => {
  it('shows text as it is and anything else as json', () => {
    expect(displayOf('Hi')).toBe('Hi');
    expect(displayOf({ a: [1] })).toBe('{"a":[1]}');
    expect(displayOf(3)).toBe('3');
  });
});

describe('badgeOf', () => {
  it('says edited as soon as the user changed a prop', () => {
    expect(badgeOf(row([example(1, { a: 1 })]), undefined, { a: 2 }, { a: 2 })).toBe(Badge.Edited);
  });

  it('says from code when the chosen example gave props', () => {
    expect(badgeOf(row([example(1, { a: 1 })]), undefined, {}, { a: 1 })).toBe(Badge.Code);
  });

  it('says sample when only the declared types gave props', () => {
    expect(badgeOf(row([]), undefined, {}, { a: 'a' })).toBe(Badge.Sample);
  });

  it('has no badge when there are no props at all', () => {
    expect(badgeOf(row([]), undefined, {}, {})).toBeNull();
    expect(badgeOf(row([]), undefined, {}, undefined)).toBeNull();
  });
});

describe('what is remembered', () => {
  it('stores an edit under its component and drops an empty edit', () => {
    const once = withEdit({}, 'k', 'title', 'Hi');

    expect(once).toEqual({ k: { title: 'Hi' } });
    expect(withEdit(once, 'k', 'title', undefined)).toEqual({});
  });

  it('keeps the other components when one changes', () => {
    expect(withEdit({ a: { x: 1 } }, 'b', 'y', 2)).toEqual({ a: { x: 1 }, b: { y: 2 } });
  });

  it('saves the picked example and the edits of a component together', () => {
    expect(savedOf({ k: 'src/p.svelte:2' }, { k: { n: 1 }, j: { m: 2 } })).toEqual({ k: { example: 'src/p.svelte:2', props: { n: 1 } }, j: { props: { m: 2 } } });
  });

  it('comes back the same after a restart', () => {
    const chosen = { k: 'src/p.svelte:2' };
    const edits = { k: { n: 1 }, j: { m: [1] } };

    expect(loadedFrom(savedOf(chosen, edits))).toEqual({ chosen, edits });
  });

  it('starts empty when nothing was saved', () => {
    expect(loadedFrom(undefined)).toEqual({ chosen: {}, edits: {} });
  });
});
