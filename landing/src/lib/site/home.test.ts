import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { AGENT_LOGOS, FAQ, TICKER_VIDEOS } from './home';
import { HOME_JSON_LD } from './structured-data';
import { LEGAL_DOCS } from './legal';

const mailtos = (html: string) => [...html.matchAll(/mailto:([^"]+)">([^<]+)</g)].map((m) => [m[1], m[2]]);

describe('the marketing homepage', () => {
  it('ships every image the page asks for', () => {
    const files = AGENT_LOGOS.map((l) => l.file);
    for (const file of files) {
      expect(existsSync(`static/site/home/${file}`), file).toBe(true);
    }
  });

  it('fills the video wall with twenty distinct clips', () => {
    expect(new Set(TICKER_VIDEOS).size).toBe(20);
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
