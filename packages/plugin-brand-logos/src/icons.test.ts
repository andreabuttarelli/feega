import { describe, expect, it } from 'vitest';
import { PACKED } from './packed.generated';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { logosData } from '../scripts/pack-icons';
import { POPULAR, bodyOf, escaped, glyphOf, loadLogos } from './icons';

describe('brand logo data', () => {
  it('is the data of the installed simple-icons package', async () => {
    expect(await unpack(PACKED)).toEqual(logosData());
  });

  it('holds thousands of brands, each with a title, a hex colour and a path', async () => {
    const logos = await loadLogos();

    expect(logos.length).toBeGreaterThan(3000);
    expect(logos.every((logo) => /^[0-9A-Fa-f]{6}$/.test(logo.hex) && /^[Mm]/.test(logo.path) && logo.title.length > 0)).toBe(true);
  });

  it('only suggests brands that exist', async () => {
    const names = new Set((await loadLogos()).map((logo) => logo.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });

  it('draws a standalone svg and an inline body with a title', async () => {
    const github = (await loadLogos()).find((logo) => logo.name === 'github')!;

    expect(glyphOf(github)).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"><path d="M12/);
    expect(bodyOf(github)).toMatch(/^<title>GitHub<\/title><path d="M12/);
  });

  it('escapes markup characters in a title', () => {
    expect(escaped('A&B <c>')).toBe('A&amp;B &lt;c&gt;');
  });
});
