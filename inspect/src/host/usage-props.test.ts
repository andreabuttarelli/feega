import { describe, expect, it } from 'vitest';
import { literalPropsOf } from './usage-props';

describe('literalPropsOf', () => {
  it('reads string, number and boolean props written as literals', () => {
    expect(literalPropsOf('<QuizCard title="Domanda 1" n={3} open={true} muted />', 'QuizCard')).toEqual({ title: 'Domanda 1', n: 3, open: true, muted: true });
  });

  it('reads the Vue binding form', () => {
    expect(literalPropsOf('<QuizCard :n="3" title="Hi" :open="false" />', 'QuizCard')).toEqual({ n: 3, title: 'Hi', open: false });
  });

  it('reads object and array literals', () => {
    expect(literalPropsOf('<List items={["a", "b"]} point={{ "x": 1 }} />', 'List')).toEqual({ items: ['a', 'b'], point: { x: 1 } });
  });

  it('reads a string literal inside braces', () => {
    expect(literalPropsOf("<Tag label={'new'} />", 'Tag')).toEqual({ label: 'new' });
  });

  it('skips what only runs at runtime: variables, calls, handlers and spreads', () => {
    expect(literalPropsOf('<Row quiz={quiz} {title} {...rest} onclick={() => go(1)} total={count + 1} label="ok" />', 'Row')).toEqual({ label: 'ok' });
  });

  it('survives a > inside an expression', () => {
    expect(literalPropsOf('<Row onclick={() => a > b} label="ok">child</Row>', 'Row')).toEqual({ label: 'ok' });
  });

  it('reads the first use that has any literal props', () => {
    expect(literalPropsOf('<Row {a} />\n<Row label="second" />', 'Row')).toEqual({ label: 'second' });
  });

  it('does not take a component whose name only starts the same', () => {
    expect(literalPropsOf('<RowHeader label="no" />', 'Row')).toBeNull();
  });

  it('is null when the component is not used or has no literal props', () => {
    expect(literalPropsOf('<div />', 'Row')).toBeNull();
    expect(literalPropsOf('<Row {a} />', 'Row')).toBeNull();
  });

  it('keeps multi-line tags', () => {
    expect(literalPropsOf('<Row\n  label="a"\n  n={2}\n/>', 'Row')).toEqual({ label: 'a', n: 2 });
  });
});
