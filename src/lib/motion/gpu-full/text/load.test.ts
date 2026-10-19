import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../../doc';
import { composeHtml } from '../../hyperframes/compose';
import { addClip, type OpResult } from '../../timeline';
import { BUILTIN_FONTS_URL, fontLoader } from './load';
import { boxFace } from './test-face';
import { bindVar, declareVar } from '../../interactive/vars';
import { VarKind } from '../../interactive/var-model';

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
    await fontLoader({ text: async () => CSS, bytes: async (url) => (fetched.push(url), new Uint8Array()) })(titled, {}, FEEGA_TOKENS);

    expect(fetched).toEqual(['https://g.test/latin.woff2']);
  });

  it('reads the files with the face engine it is given', async () => {
    const read: Uint8Array[] = [];
    const engine = async () => (bytes: Uint8Array) => (read.push(bytes), { axes: {}, covers: () => true, at: () => boxFace });
    const book = await fontLoader({ text: async () => CSS, bytes: async () => new Uint8Array([1]) }, engine)(titled, {}, FEEGA_TOKENS);

    expect(read).toHaveLength(1);
    expect(book({ family: 'DM Sans', weight: 400, italic: false, size: 10, axes: {} }, 0x48)?.face.shape).toBe(boxFace.shape);
  });

  it('starts the face engine only once a file is read', () => {
    let started = 0;
    fontLoader({ text: async () => CSS, bytes: async () => new Uint8Array() }, async () => (started++, () => ({ axes: {}, covers: () => true, at: () => boxFace })));

    expect(started).toBe(0);
  });

  it('downloads the subsets a custom component writes, from its props and its source', async () => {
    const ticked = must(addClip({ ...titled, components: { Card: { source: { html: '', css: '', js: "make('div', 'tick', box, 'Ā')" }, propsSchema: { type: 'object', properties: {} }, version: 1, check: null } } } as MotionDoc, { component: 'Custom', from: 0, durationInFrames: 30, props: { name: 'Card' } }, 'card'));
    const fetched: string[] = [];
    await fontLoader({ text: async () => CSS, bytes: async (url) => (fetched.push(url), new Uint8Array()) })(ticked, {}, FEEGA_TOKENS);

    expect(fetched).toContain('https://g.test/ext.woff2');
  });

  it('asks for the fonts of clips inside a precomp', async () => {
    const [clip] = titled.tracks.flatMap((t) => t.clips);
    const archivo = { family: 'Archivo', source: 'google', category: 'sans', italic: false, weights: [400], axes: [] };
    const inner = { ...titled.tracks[0], clips: [{ ...clip, props: { ...clip.props, font: 'Archivo' } }] };
    const nested = { ...titled, fonts: [archivo], comps: { c1: { name: 'c1', durationInFrames: 30, tracks: [inner] } }, tracks: titled.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, component: 'Precomp', props: { comp: 'c1' } })) })) } as unknown as MotionDoc;
    const sheets: string[] = [];
    await fontLoader({ text: async (url) => (sheets.push(url), ''), bytes: async () => new Uint8Array() })(nested, {}, FEEGA_TOKENS);

    expect(sheets.some((url) => url.includes('family=Archivo'))).toBe(true);
  });

  it('loads the subset of every character a bound variable shows, euro and beyond Latin-1', async () => {
    const SUBSETS = `${CSS}
/* symbols */ @font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 400; src: url(https://g.test/euro.woff2); unicode-range: U+20AC, U+2122; }`;
    const kicked = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Kicker', from: 0, durationInFrames: 30, props: { text: 'price' } }, 'k'));
    const declared = must(declareVar(kicked, { name: 'price', kind: VarKind.String, default: '€ 129 ™ Ā' }));
    const bound = must(bindVar(declared, { var: 'price', clip: 'k', prop: 'text' }));
    const fetched: string[] = [];
    await fontLoader({ text: async () => SUBSETS, bytes: async (url) => (fetched.push(url), new Uint8Array()) })(bound, {}, FEEGA_TOKENS);

    expect(fetched.sort()).toEqual(['https://g.test/euro.woff2', 'https://g.test/ext.woff2', 'https://g.test/latin.woff2']);
  });
});
