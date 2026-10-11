import { describe, expect, it } from 'vitest';
import { SectionKind, linksWorthReading, pageOf, quoted, sectionsOf, unsourcedFigures } from './site-copy';

const HOME = `<html><head><title>Supasito</title><script>var x = '<p>no</p>'</script></head><body>
<nav><a href="/pricing">Pricing</a><a href="/login">Log in</a></nav>
<h1>Every site you run. Up to date. In one place.</h1>
<p>Say what should change. See it before it goes live.</p>
<h3>Your afternoons.</h3><p>Make the change while you describe it.</p>
<h2>The deal is simple.</h2><h3>Personal use</h3><p>Free.</p>
<h2>A few things to know.</h2><details><summary>Do I need Claude Code?</summary><p>You need Claude Code with a compatible paid Claude plan.</p></details>
<h3>Probably not your app if…</h3><li>Your sites live in WordPress, Squarespace, Webflow or Wix.</li>
<a href="https://supasito.com/features">How it works</a><a href="https://other.com/pricing">x</a><a href="/terms">Terms</a><a href="/blog/post">A post</a>
</body></html>`;

describe('reading a site for its story', () => {
  it('keeps the hero, sections and their lines, without scripts', () => {
    const sections = sectionsOf(HOME);

    expect(sections[0]).toEqual({ kind: SectionKind.Hero, heading: 'Every site you run. Up to date. In one place.', lines: ['Say what should change. See it before it goes live.'] });
    expect(sections.flatMap((s) => s.lines).join(' ')).not.toContain('no');
  });

  it('tells pricing, FAQ and audience sections apart', () => {
    const kinds = Object.fromEntries(sectionsOf(HOME).map((s) => [s.heading, s.kind]));

    expect(kinds['The deal is simple.']).toBe(SectionKind.Pricing);
    expect(kinds['A few things to know.']).toBe(SectionKind.Faq);
    expect(kinds['Probably not your app if…']).toBe(SectionKind.Audience);
  });

  it('follows only same-site pages worth reading, best first', () => {
    expect(linksWorthReading(HOME, 'https://supasito.com/')).toEqual(['https://supasito.com/pricing', 'https://supasito.com/features']);
  });

  it('accepts a claim only when its quote is on the page it names', () => {
    const pages = [pageOf('https://supasito.com/', HOME)];

    expect(quoted(pages, { url: 'https://www.supasito.com', quote: 'See it before it goes live' })).toBe(true);
    expect(quoted(pages, { url: 'https://supasito.com/', quote: 'Ships 10x faster' })).toBe(false);
    expect(quoted(pages, { url: 'https://supasito.com/pricing', quote: 'Free.' })).toBe(false);
  });
});

describe('figures shown on screen come from the site', () => {
  const site = [{ url: 'https://feega.app/', title: 'feega', sections: [{ kind: SectionKind.Pricing, heading: 'Pricing', lines: ['Pro is $29 per month', 'Render 4K in 2 minutes', '10,000 creators'] }] }];

  it('refuses a figure the site never states (v4 showed "1 credit = $1")', () => {
    expect(unsourcedFigures(['1', 'credit = $1'], site, [])).toEqual(['1', '$1']);
  });

  it('accepts figures the site states, however they are spaced', () => {
    expect(unsourcedFigures(['$29', '4K', '10,000 creators', '2 minutes'], site, [])).toEqual([]);
  });

  it('accepts a figure quoted in the saved script', () => {
    expect(unsourcedFigures(['3x faster'], site, ['Teams ship 3x faster'])).toEqual([]);
  });

  it('a text without digits is not a figure', () => {
    expect(unsourcedFigures(['One idea. Ten tools.'], site, [])).toEqual([]);
  });
});
