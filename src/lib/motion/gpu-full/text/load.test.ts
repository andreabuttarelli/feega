import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../../doc';
import { composeHtml } from '../../hyperframes/compose';
import { addClip, type OpResult } from '../../timeline';
import { BUILTIN_FONTS_URL, fontLoader } from './load';

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

  it('asks for the fonts of clips inside a precomp', async () => {
    const [clip] = titled.tracks.flatMap((t) => t.clips);
    const archivo = { family: 'Archivo', source: 'google', category: 'sans', italic: false, weights: [400], axes: [] };
    const inner = { ...titled.tracks[0], clips: [{ ...clip, props: { ...clip.props, font: 'Archivo' } }] };
    const nested = { ...titled, fonts: [archivo], comps: { c1: { name: 'c1', durationInFrames: 30, tracks: [inner] } }, tracks: titled.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, component: 'Precomp', props: { comp: 'c1' } })) })) } as unknown as MotionDoc;
    const sheets: string[] = [];
    await fontLoader({ text: async (url) => (sheets.push(url), ''), bytes: async () => new Uint8Array() })(nested, {});

    expect(sheets.some((url) => url.includes('family=Archivo'))).toBe(true);
  });
});
