import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../../doc';
import { composeHtml } from '../../hyperframes/compose';
import { addClip, type OpResult } from '../../timeline';
import { readFileSync } from 'node:fs';
import { BUILTIN_FONTS_URL, facesLoader, fontLoader } from './load';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const titled = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Hi' } }, 't'));

const CSS = `/* latin-ext */ @font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 400; src: url(https://g.test/ext.woff2); unicode-range: U+0100-02BA; }
/* latin */ @font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 400; src: url(https://g.test/latin.woff2); unicode-range: U+0000-00FF; }`;

describe('loadFonts', () => {
  it('asks for the same built-in fonts the HTML engine links', () => {
    const html = composeHtml({ doc: titled, tokens: FEEGA_TOKENS, assets: {} });

    expect(html.replaceAll('&amp;', '&')).toContain(BUILTIN_FONTS_URL);
  });

  it('downloads only the subsets the clips have characters in', async () => {
    const fetched: string[] = [];
    await fontLoader({ text: async () => CSS, bytes: async (url) => (fetched.push(url), new Uint8Array()) })(titled, {});

    expect(fetched).toEqual(['https://g.test/latin.woff2']);
  });

  it('hands the native core only the faces whose files loaded', async () => {
    const latin = new Uint8Array(readFileSync('static/fonts/dm-sans-latin.woff2'));
    const { native } = await facesLoader({ text: async () => CSS, bytes: async () => latin })(titled, {});

    expect(native.rules.map((r) => r.url)).toEqual(['https://g.test/latin.woff2']);
  });
});
