import { describe, expect, it } from 'vitest';
import { SourceKind, sourceOf } from './source';

describe('sourceOf', () => {
  const cases: [string, unknown][] = [
    ['github:acme/hello', { kind: SourceKind.Github, owner: 'acme', repo: 'hello', tag: null }],
    ['github:acme/hello@v1.2.0', { kind: SourceKind.Github, owner: 'acme', repo: 'hello', tag: 'v1.2.0' }],
    ['feega-plugin-hello', { kind: SourceKind.Npm, name: 'feega-plugin-hello', version: null }],
    ['feega-plugin-hello@1.2.0', { kind: SourceKind.Npm, name: 'feega-plugin-hello', version: '1.2.0' }],
    ['@acme/hello', { kind: SourceKind.Npm, name: '@acme/hello', version: null }],
    ['@acme/hello@2.0.1', { kind: SourceKind.Npm, name: '@acme/hello', version: '2.0.1' }]
  ];

  it.each(cases)('reads %s', (text, expected) => {
    expect(sourceOf(text)).toEqual(expected);
  });

  it.each(['', 'github:acme', 'github:/hello', 'https://evil.example/x.tgz', '../local', 'a b', 'github:acme/hello@'])('refuses %j', (text) => {
    expect(sourceOf(text)).toBeNull();
  });
});
