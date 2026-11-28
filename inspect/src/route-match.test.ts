import { describe, expect, it } from 'vitest';
import { assignExamples, fillRoute, labelOf, matchRoute, paramsOf } from './route-match';

describe('matchRoute', () => {
  it.each([
    ['/blog/[slug]', '/blog/primo-post', { slug: 'primo-post' }],
    ['/[id]', '/42', { id: '42' }],
    ['/users/[id]/posts/[post]', '/users/7/posts/hi', { id: '7', post: 'hi' }],
    ['/docs/[...rest]', '/docs/a/b/c', { rest: 'a/b/c' }],
    ['/docs/[...rest]', '/docs/a', { rest: 'a' }],
    ['/docs/[[...rest]]', '/docs', {}],
    ['/docs/[[...rest]]', '/docs/a/b', { rest: 'a/b' }],
    ['/[[lang]]/about', '/about', {}],
    ['/[[lang]]/about', '/it/about', { lang: 'it' }],
    ['/[[lang]]', '/', {}],
    ['/blog/[slug=word]', '/blog/hello', { slug: 'hello' }],
    ['/(marketing)/blog/[slug]', '/blog/hello', { slug: 'hello' }],
    ['/blog/[slug]', '/blog/hello/', { slug: 'hello' }],
    ['/blog/[slug]', '/blog/hello?tab=2#top', { slug: 'hello' }],
    ['/about', '/about', {}]
  ])('%s matches %s', (pattern, path, expected) => {
    expect(matchRoute(pattern, path)).toEqual(expected);
  });

  it.each([
    ['/blog/[slug]', '/blog'],
    ['/blog/[slug]', '/blog/'],
    ['/blog/[slug]', '/blog/a/b'],
    ['/blog/[slug]', '/news/a'],
    ['/docs/[...rest]', '/docs'],
    ['/[id]', '/'],
    ['/about', '/about/team']
  ])('%s does not match %s', (pattern, path) => {
    expect(matchRoute(pattern, path)).toBe(null);
  });
});

describe('paramsOf', () => {
  it('lists the params in order, with whether each is required', () => {
    expect(paramsOf('/[[lang]]/blog/[slug]/[...rest]')).toEqual([
      { name: 'lang', required: false },
      { name: 'slug', required: true },
      { name: 'rest', required: true }
    ]);
  });

  it('has none for a static route', () => {
    expect(paramsOf('/about')).toEqual([]);
  });
});

describe('fillRoute', () => {
  it('builds the concrete path from values', () => {
    expect(fillRoute('/blog/[slug]', { slug: 'hello' })).toBe('/blog/hello');
    expect(fillRoute('/docs/[...rest]', { rest: 'a/b' })).toBe('/docs/a/b');
  });

  it('skips an empty optional param', () => {
    expect(fillRoute('/[[lang]]/about', { lang: '' })).toBe('/about');
    expect(fillRoute('/[[lang]]/about', { lang: 'it' })).toBe('/it/about');
  });

  it('refuses a missing required value', () => {
    expect(fillRoute('/blog/[slug]', { slug: '  ' })).toBe(null);
    expect(fillRoute('/blog/[slug]', {})).toBe(null);
  });

  it('refuses a slash inside a single-segment value', () => {
    expect(fillRoute('/blog/[slug]', { slug: 'a/b' })).toBe(null);
  });

  it('trims the value and its slashes for a catch-all', () => {
    expect(fillRoute('/docs/[...rest]', { rest: ' /a/b/ ' })).toBe('/docs/a/b');
  });

  it('round-trips through matchRoute', () => {
    const path = fillRoute('/u/[id]/[...rest]', { id: '3', rest: 'x/y' })!;

    expect(matchRoute('/u/[id]/[...rest]', path)).toEqual({ id: '3', rest: 'x/y' });
  });
});

describe('labelOf', () => {
  it('shows the values that fill the params', () => {
    expect(labelOf('/blog/[slug]', '/blog/primo-post')).toBe('primo-post');
    expect(labelOf('/users/[id]/posts/[post]', '/users/7/posts/hi')).toBe('7 / hi');
  });

  it('falls back to the path', () => {
    expect(labelOf('/about', '/about')).toBe('/about');
  });
});

describe('assignExamples', () => {
  const patterns = ['/blog/[slug]', '/docs/[...rest]', '/[page]'];

  it('gives each path to the pattern it matches, in order, once', () => {
    expect(assignExamples(patterns, ['/blog/a', '/docs/x/y', '/blog/a', '/blog/b/', '/pricing'])).toEqual({
      '/blog/[slug]': ['/blog/a', '/blog/b'],
      '/docs/[...rest]': ['/docs/x/y'],
      '/[page]': ['/pricing']
    });
  });

  it('strips query and hash', () => {
    expect(assignExamples(patterns, ['/blog/a?x=1', '/blog/a#t'])['/blog/[slug]']).toEqual(['/blog/a']);
  });

  it('prefers the pattern with more static segments', () => {
    expect(assignExamples(['/[a]/[b]', '/blog/[slug]'], ['/blog/x'])).toEqual({ '/[a]/[b]': [], '/blog/[slug]': ['/blog/x'] });
  });

  it('leaves unmatched paths out', () => {
    expect(assignExamples(patterns, ['/a/b/c'])).toEqual({ '/blog/[slug]': [], '/docs/[...rest]': [], '/[page]': [] });
  });
});
