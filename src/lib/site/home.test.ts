import { describe, expect, it } from 'vitest';
import { FAQ, SHOWCASE_NARROW, SHOWCASE_WIDE } from './home';
import { HOME_JSON_LD } from './structured-data';
import { LEGAL_DOCS } from './legal';

const mailtos = (html: string) => [...html.matchAll(/mailto:([^"]+)">([^<]+)</g)].map((m) => [m[1], m[2]]);

describe('the marketing homepage', () => {
  it('shows every showcase video in both layouts', () => {
    const files = (cols: typeof SHOWCASE_WIDE) => cols.flat().map((v) => v.file).sort();
    expect(files(SHOWCASE_NARROW)).toEqual(files(SHOWCASE_WIDE));
  });

  it('names feega’s founder, not the template author', () => {
    expect(HOME_JSON_LD).toContain('Andrea Buttarelli');
    expect(HOME_JSON_LD).not.toMatch(/Ezio|Salazar|framer/i);
  });

  it('every mailto link points where its text says', () => {
    const html = [...FAQ.map((f) => f.a), ...Object.values(LEGAL_DOCS).map((d) => d.html)].join('');
    for (const [href, text] of mailtos(html)) {
      expect(href).toBe(text);
    }
  });

  it('keeps no template leftovers in the copy', () => {
    const html = Object.values(LEGAL_DOCS).map((d) => d.html).join('');
    expect(html).not.toMatch(/## Annex|SUBPROCESSORS\.md|hello@|\[SUPPORT EMAIL\]|\[LEGAL NOTICE EMAIL\]/);
  });
});
