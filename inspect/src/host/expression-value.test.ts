import { describe, expect, it } from 'vitest';
import { UNRESOLVED, valueOfExpression, type Lookup } from './expression-value';

const names: Record<string, unknown> = { quiz: { title: 'Quiz', levels: [{ id: 1 }, { id: 2 }], n: 3 }, list: ['a', 'b'] };
const lookup: Lookup = (name) => (name in names ? (names[name] as never) : UNRESOLVED);

const SHAPES: [string, string, unknown][] = [
  ['a string with double quotes', '"Domanda 1"', 'Domanda 1'],
  ['a string with single quotes', "'it'", 'it'],
  ['an escaped quote', "'it\\'s'", "it's"],
  ['a template without expressions', '`plain text`', 'plain text'],
  ['an integer', '3', 3],
  ['a negative decimal', '-2.5', -2.5],
  ['true', 'true', true],
  ['false', 'false', false],
  ['null', 'null', null],
  ['an array literal', '[1, "a", true]', [1, 'a', true]],
  ['an empty array', '[]', []],
  ['an object literal', '{ title: "Hi", n: 2 }', { title: 'Hi', n: 2 }],
  ['an object with quoted keys and a trailing comma', '{ "a-b": 1, }', { 'a-b': 1 }],
  ['nested literals', '{ items: [{ id: 1 }, { id: 2 }] }', { items: [{ id: 1 }, { id: 2 }] }],
  ['a shorthand property that resolves', '{ quiz }', { quiz: names.quiz }],
  ['an identifier that resolves', 'quiz', names.quiz],
  ['a member access', 'quiz.title', 'Quiz'],
  ['an optional member access', 'quiz?.title', 'Quiz'],
  ['an index access', 'list[1]', 'b'],
  ['a chain of members and indexes', 'quiz.levels[1].id', 2],
  ['a string key access', 'quiz["n"]', 3],
  ['an as const assertion', '["a", "b"] as const', ['a', 'b']],
  ['a satisfies assertion', '{ a: 1 } satisfies Thing', { a: 1 }],
  ['a literal in parentheses', '(5)', 5]
];

describe('valueOfExpression: supported shapes', () => {
  it.each(SHAPES)('reads %s', (_name, source, expected) => {
    expect(valueOfExpression(source, lookup)).toEqual(expected);
  });
});

const NOT_SUPPORTED: [string, string][] = [
  ['a name nothing defines', 'missing'],
  ['a member of something unknown', 'missing.title'],
  ['an index out of range', 'list[9]'],
  ['a function call', 'quizzes.find((q) => q.id === 1)'],
  ['a template with an expression', '`a ${quiz.n}`'],
  ['a binary expression', '1 + 2'],
  ['a conditional', 'quiz ? 1 : 2'],
  ['an arrow function', '() => 1'],
  ['a new expression', 'new Date()'],
  ['an empty expression', '']
];

describe('valueOfExpression: unsupported shapes are left unresolved and never run', () => {
  it.each(NOT_SUPPORTED)('leaves %s unresolved', (_name, source) => {
    expect(valueOfExpression(source, lookup)).toBe(UNRESOLVED);
  });

  it('keeps the properties of an object that do resolve and drops the ones that do not', () => {
    expect(valueOfExpression('{ a: 1, b: missing, c: x => x, d: "ok" }', lookup)).toEqual({ a: 1, d: 'ok' });
  });

  it('drops the entries of an array that do not resolve', () => {
    expect(valueOfExpression('[1, missing, 3]', lookup)).toEqual([1, 3]);
  });
});
