import { describe, expect, it } from 'vitest';
import { routeMatches } from './route-pattern';

describe('routeMatches: a typed path against a discovered pattern', () => {
  it.each([
    ['/', '/', true],
    ['/', '/about', false],
    ['/blog/[slug]', '/blog/hello', true],
    ['/blog/[slug]', '/blog/hello/', true],
    ['/blog/[slug]', '/blog', false],
    ['/blog/[slug]', '/blog/a/b', false],
    ['/docs/[...slug]', '/docs/a/b', true],
    ['/docs/[...slug]', '/docs', false],
    ['/docs/[[...slug]]', '/docs', true],
    ['/docs/[[...slug]]', '/docs/a/b', true],
    ['/[[lang]]/about', '/about', true],
    ['/[[lang]]/about', '/it/about', true],
    ['/og/[slug].png', '/og/card.png', true],
    ['/a.b/[x]', '/aXb/1', false]
  ])('%s against %s is %s', (pattern, path, expected) => {
    expect(routeMatches(pattern, path)).toBe(expected);
  });
});
