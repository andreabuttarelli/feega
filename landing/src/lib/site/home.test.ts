import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { FAQ, COLLAGE, COLLAGE_STAGE, IMAGINE } from './home';
import { HOME_JSON_LD } from './structured-data';
import { LEGAL_DOCS } from './legal';

const mailtos = (html: string) => [...html.matchAll(/mailto:([^"]+)">([^<]+)</g)].map((m) => [m[1], m[2]]);

describe('the marketing homepage', () => {
  it('ships every collage image and places every tile inside the stage', () => {
    for (const tile of COLLAGE) {
      if (tile.kind === 'image') {
        expect(existsSync(`static/site/home/${tile.file}.webp`), tile.file).toBe(true);
      }

      expect(tile.x + tile.w, tile.file).toBeLessThanOrEqual(COLLAGE_STAGE.width);
      expect(tile.y + tile.h, tile.file).toBeLessThanOrEqual(COLLAGE_STAGE.height);
    }
  });

  it('never repeats a collage video', () => {
    const videos = COLLAGE.filter((t) => t.kind === 'video').map((t) => t.file);
    expect(new Set(videos).size).toBe(videos.length);
  });

  it('lists the eight things you can bring to life', () => {
    expect(IMAGINE).toHaveLength(8);
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
