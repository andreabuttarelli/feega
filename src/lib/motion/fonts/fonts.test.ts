import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setProps, type OpResult } from '../timeline';
import { FEEGA_TOKENS } from '../brand';
import { composeHtml } from '../hyperframes/compose';
import { cspPolicy } from '../hyperframes/csp';
import { writeComponent } from '../custom/ops';
import { extractParams } from '../custom/params';
import { BuiltinFont, fontStack, fontsFrom, googleFontsUrl, searchFonts, usedFaces, type CatalogueFont } from './model';
import { registerUpload, removeFont, setFont } from './ops';

const FACE_JS = "param('face', 'sans', { type: 'font' });";

const CATALOGUE: CatalogueFont[] = [
  { f: 'Inter', c: 'sans', w: [100, 200, 300, 400, 500, 600, 700, 800, 900], i: 1 },
  { f: 'Playfair Display', c: 'serif', w: [400, 500, 600, 700, 800, 900], i: 1 },
  { f: 'Bebas Neue', c: 'display', w: [400], i: 0 },
  { f: 'JetBrains Mono', c: 'mono', w: [100, 400, 800], i: 1 }
];

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const titled = () => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 'title'));
const compose = (doc: MotionDoc, assets: Record<string, string> = {}) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets });

describe('fonts', () => {
  it('text clips default to the built-in sans at their usual weight', () => {
    expect(findClip(titled(), 'title')!.clip.props).toMatchObject({ font: BuiltinFont.Sans, weight: 500, italic: false });
    expect(fontStack(BuiltinFont.Mono, [])).toContain("'Fragment Mono'");
  });

  it('set_font registers a Google family with its real weights and sets the clip; unknown names come back with suggestions', () => {
    const doc = ok(setFont(titled(), 'title', { family: 'Playfair Display', weight: 700, italic: true }, CATALOGUE));

    expect(doc.fonts).toEqual([{ family: 'Playfair Display', source: 'google', category: 'serif', weights: [400, 500, 600, 700, 800, 900], italic: true, axes: [] }]);
    expect(findClip(doc, 'title')!.clip.props).toMatchObject({ font: 'Playfair Display', weight: 700, italic: true });
    expect(setFont(titled(), 'title', { family: 'Playfare' }, CATALOGUE)).toMatchObject({ ok: false, error: expect.stringContaining('Playfair Display') });
    expect(setFont(titled(), 'title', { family: 'Bebas Neue', italic: true }, CATALOGUE)).toMatchObject({ ok: false, error: expect.stringContaining('italic') });
  });

  it('a clip cannot point at a family the video has not registered', () => {
    expect(setProps(titled(), 'title', { font: 'Inter' })).toMatchObject({ ok: false, error: expect.stringContaining('register_font') });
    const doc = ok(setFont(titled(), 'title', { family: 'Inter' }, CATALOGUE));
    expect(parseMotionDoc(JSON.parse(JSON.stringify(doc))).ok).toBe(true);
  });

  it('collects every face in use, and asks Google only for weights the family has', () => {
    let doc = ok(setFont(titled(), 'title', { family: 'JetBrains Mono', weight: 600 }, CATALOGUE));
    doc = ok(addClip(doc, { component: 'Text', from: 0, durationInFrames: 30, props: { font: 'JetBrains Mono', weight: 400, italic: true } }, 'body'));

    expect(usedFaces(doc)).toEqual([
      { family: 'JetBrains Mono', weight: 600, italic: false },
      { family: 'JetBrains Mono', weight: 400, italic: true }
    ]);
    expect(googleFontsUrl(usedFaces(doc), doc.fonts)).toBe('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,800;1,400&display=block');
  });

  it('the composition loads the faces, gates custom code and capture on them, and falls back by category', () => {
    const doc = ok(setFont(titled(), 'title', { family: 'Playfair Display', weight: 700 }, CATALOGUE));
    const html = compose(doc);

    expect(html).toContain('href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700&amp;display=block"');
    expect(html).toContain(`document.fonts.load("normal 700 1em \\"Playfair Display\\"")`);
    expect(html).toContain("font-family:'Playfair Display', Georgia, serif");
    expect(html).toContain('font-weight:700');
  });

  it('declares each Google family in the page, so the server renderer keeps it instead of swapping in a bundled look-alike', () => {
    const doc = ok(setFont(titled(), 'title', { family: 'Bebas Neue' }, CATALOGUE));
    expect(compose(doc)).toContain("@font-face{font-family:'Bebas Neue';src:local('feega-declared');font-weight:1;unicode-range:U+0}");
  });

  it('text asks for the weight the family really has, so no browser synthesises or substitutes one', () => {
    const doc = ok(setFont(titled(), 'title', { family: 'Bebas Neue' }, CATALOGUE));
    expect(compose(doc)).toContain("font-family:'Bebas Neue', system-ui, sans-serif;font-weight:400");
  });

  it('every face in use sits in an invisible probe in the frame, so a browser export embeds fonts that appear only later', () => {
    let doc = ok(setFont(titled(), 'title', { family: 'Playfair Display', weight: 700, italic: true }, CATALOGUE));
    doc = ok(addClip(doc, { component: 'Text', from: 40, durationInFrames: 20, props: { font: 'Playfair Display', weight: 400 } }, 'late'));
    const probe = /<div class="font-probe"[^>]*>(.*?)<\/div>/.exec(compose(doc))?.[1] ?? '';

    expect(probe).toContain("font-family:'Playfair Display', Georgia, serif;font-weight:700;font-style:italic");
    expect(probe).toContain("font-family:'Playfair Display', Georgia, serif;font-weight:400;font-style:normal");
  });

  it('an uploaded font is a @font-face on its asset, allowed by the policy, and can be removed only when unused', () => {
    let doc = ok(registerUpload(titled(), { assetId: 'f1', family: 'Acme Grotesk', weights: [400], italic: false }));
    doc = ok(setFont(doc, 'title', { family: 'Acme Grotesk', weight: 400 }, CATALOGUE));
    const html = compose(doc, { f1: 'https://cdn.example.com/acme.woff2' });

    expect(doc.assets).toContainEqual({ id: 'f1', kind: 'font', name: 'Acme Grotesk' });
    expect(html).toContain("@font-face{font-family:'Acme Grotesk';src:url(\"https://cdn.example.com/acme.woff2\");font-weight:400;font-style:normal;font-display:block}");
    expect(cspPolicy({ scripts: [], assetUrls: ['https://cdn.example.com/acme.woff2'] })).toMatch(/font-src [^;]*https:\/\/cdn\.example\.com/);
    expect(removeFont(doc, 'Acme Grotesk')).toMatchObject({ ok: false, error: expect.stringContaining('title') });
  });

  it('custom component font params take any registered family and reach the code as a CSS stack', () => {
    let doc = ok(writeComponent(titled(), 'Card', { source: { html: '<p></p>', css: '', js: FACE_JS }, propsSchema: { type: 'object', properties: extractParams(FACE_JS) } }));
    doc = ok(setFont(doc, 'title', { family: 'Inter' }, CATALOGUE));
    doc = ok(addClip(doc, { component: 'Custom', from: 0, durationInFrames: 30, props: { name: 'Card', face: 'Inter' } }, 'card'));

    expect(usedFaces(doc)).toContainEqual({ family: 'Inter', weight: 400, italic: false });
    expect(compose(doc)).toContain('"face":"\'Inter\', system-ui, sans-serif"');
  });

  it('search ranks prefix matches first and keeps catalogue order (popularity) within them; brand fonts lead', () => {
    expect(searchFonts(CATALOGUE, 'in', [], 10).map((f) => f.f)).toEqual(['Inter', 'JetBrains Mono']);
    expect(searchFonts(CATALOGUE, 'mono', [], 10).map((f) => f.f)).toEqual(['JetBrains Mono']);
    expect(searchFonts(CATALOGUE, '', ['Bebas Neue'], 2).map((f) => f.f)).toEqual(['Bebas Neue', 'Inter']);
  });

  it('reads the brand fonts out of the brand text, only names Google serves', () => {
    expect(fontsFrom('Typography: Playfair Display for titles, Inter for body. Not Helvetica.', CATALOGUE)).toEqual(['Playfair Display', 'Inter']);
  });
});
