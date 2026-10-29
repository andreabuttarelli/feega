import { describe, expect, it } from 'vitest';
import { Kind, highlight } from './highlight';

const kinds = (code: string) => highlight(code)[0].map((t) => [t.kind, t.text]);

describe('highlight', () => {
  it('colours a CSS declaration', () => {
    expect(kinds('width: 480px;')).toEqual([[Kind.Property, 'width'], [Kind.Plain, ': '], [Kind.Number, '480px'], [Kind.Plain, ';']]);
  });

  it('colours tags, attributes and strings', () => {
    expect(kinds('<a href="/x">')).toEqual([[Kind.Tag, '<a'], [Kind.Plain, ' '], [Kind.Property, 'href'], [Kind.Plain, '='], [Kind.String, '"/x"'], [Kind.Plain, '>']]);
  });

  it('keeps a url inside a string out of the comment rule', () => {
    expect(kinds('"https://a.b"')).toEqual([[Kind.String, '"https://a.b"']]);
  });

  it('splits multi-line tokens into lines and rebuilds the source', () => {
    const code = '<!-- a\nb -->\nconst x = 1;';
    const lines = highlight(code);

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.map((t) => t.text).join('')).join('\n')).toBe(code);
  });
});
