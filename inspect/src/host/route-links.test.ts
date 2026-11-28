import { describe, expect, it } from 'vitest';
import { linksOf } from './route-links';

describe('linksOf', () => {
  it.each([
    ['svelte href', '<a href="/alternatives/figma">Figma</a>', ['/alternatives/figma']],
    ['single quotes', "<a href='/for/react'>", ['/for/react']],
    ['jsx braces', '<Link href={"/blog/hello"}>', ['/blog/hello']],
    ['next link', '<Link href="/blog/hello">x</Link>', ['/blog/hello']],
    ['goto', "goto('/x/y')", ['/x/y']],
    ['router push', 'router.push(`/docs/intro`)', ['/docs/intro']],
    ['object key', "const link = { href: '/pricing/team' }", ['/pricing/team']],
    ['markdown', 'see [Figma](/alternatives/figma) now', ['/alternatives/figma']],
    ['template without expression', 'href={`/a/b`}', ['/a/b']],
    ['query and hash dropped', '<a href="/a/b?x=1#top">', ['/a/b']],
    ['trailing slash dropped', '<a href="/a/b/">', ['/a/b']]
  ])('%s', (_name, text, expected) => {
    expect(linksOf(text)).toEqual(expected);
  });

  it.each([
    ['template with expression', 'href={`/a/${slug}`}'],
    ['external', '<a href="https://x.com/a/b">'],
    ['protocol relative', '<a href="//x.com/a">'],
    ['asset', '<a href="/files/report.pdf">'],
    ['root only', '<a href="/">'],
    ['anchor', '<a href="#top">'],
    ['not a link attribute', 'const label = "/a/b"']
  ])('ignores %s', (_name, text) => {
    expect(linksOf(text)).toEqual([]);
  });

  it('keeps each path once', () => {
    expect(linksOf('<a href="/a/b"></a><a href="/a/b"></a>')).toEqual(['/a/b']);
  });
});
