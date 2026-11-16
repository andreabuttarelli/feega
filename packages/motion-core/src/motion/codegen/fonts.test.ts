import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '../doc';
import { CodeTarget, codeAssetIds, exportCode, type CodeExport } from './index';
import { box, DocKit } from './fixtures/kit';

const URLS = { 'f-400': 'https://cdn.test/fonts/brandon-400.woff2?sig=1', 'f-700': 'https://cdn.test/fonts/brandon-700.otf?sig=2', 'f-var': 'https://cdn.test/fonts/mono.woff2' };

const upload = { family: 'Brandon', source: 'upload', category: 'sans', weights: [400, 700], italic: false, axes: [], variants: [{ assetId: 'f-400', weight: 400, italic: false }, { assetId: 'f-700', weight: 700, italic: true }] };
const variable = { family: 'Mono Var', source: 'upload', category: 'mono', weights: [100, 900], italic: false, axes: [], variants: [{ assetId: 'f-var', weight: 100, maxWeight: 900, italic: false }] };
const google = { family: 'Inter', source: 'google', category: 'sans', weights: [400], italic: false, axes: [['wght', 100, 900]] };
const local = { family: 'Gill Sans', source: 'local', category: 'sans', weights: [400], italic: false, axes: [] };

function docUsing(fonts: unknown[], families: string[]): MotionDoc {
  const kit = new DocKit(800, 400);
  kit.frame('page', { name: 'Page', box: box(0, 0, 800, 400), fill: '#ffffff' });
  families.forEach((font, i) => kit.text(`t${i}`, 'Hello', { parent: 'page', name: `Line ${i}`, size: 32, font, box: box(0, i * 60, 300, 40) }));
  return { ...kit.doc(), fonts } as MotionDoc;
}

const file = (out: CodeExport, path: string) => out.files.find((f) => f.path === path)?.content ?? '';
const exported = (doc: MotionDoc, target: CodeTarget) => exportCode(doc, { target, name: 'Page', assets: URLS });

describe('uploaded fonts ship with the export', () => {
  const doc = docUsing([upload, variable], ['Brandon', 'Mono Var']);

  it('writes @font-face rules for every variant, next to the tokens', () => {
    const css = file(exported(doc, CodeTarget.Html), 'styles/fonts.css');
    expect(css).toContain('font-family: "Brandon";');
    expect(css).toContain('src: url("../assets/f-400.woff2") format("woff2");');
    expect(css).toContain('src: url("../assets/f-700.otf") format("opentype");');
    expect(css).toContain('font-style: italic;');
    expect(css).toContain('font-weight: 100 900;');
  });

  it('links the font stylesheet and leaves Google Fonts out of it', () => {
    const html = file(exported(doc, CodeTarget.Html), 'index.html');
    expect(html).toContain('<link rel="stylesheet" href="styles/fonts.css" />');
    expect(html).not.toContain('googleapis');
  });

  it('bundles the font files with the page assets', () => {
    expect(exported(doc, CodeTarget.Html).assets.map((a) => a.path).sort()).toEqual(['assets/f-400.woff2', 'assets/f-700.otf', 'assets/f-var.woff2']);
  });

  it('imports the font stylesheet in React and serves the files from public', () => {
    const out = exported(doc, CodeTarget.React);
    expect(file(out, 'src/index.css')).toContain('@import "./fonts.css";');
    expect(file(out, 'src/fonts.css')).toContain('src: url("/assets/f-400.woff2") format("woff2");');
    expect(out.assets.map((a) => a.path)).toContain('public/assets/f-400.woff2');
  });

  it('imports the font stylesheet in Svelte and serves the files from static', () => {
    const out = exported(doc, CodeTarget.Svelte);
    expect(file(out, 'src/app.css')).toContain("@import './lib/styles/fonts.css';");
    expect(file(out, 'src/lib/styles/fonts.css')).toContain('src: url("/assets/f-400.woff2") format("woff2");');
    expect(out.assets.map((a) => a.path)).toContain('static/assets/f-400.woff2');
  });

  it('lists the font files among the assets the caller has to sign', () => {
    expect(codeAssetIds(doc)).toEqual(['f-400', 'f-700', 'f-var']);
  });

  it('does not ship a font no layer uses', () => {
    expect(codeAssetIds(docUsing([upload, variable], ['Brandon']))).toEqual(['f-400', 'f-700']);
  });
});

describe('fonts the product serves', () => {
  it('requests the variable range of a Google font, not a fixed weight list', () => {
    const html = file(exported(docUsing([google], ['Inter']), CodeTarget.Html), 'index.html');
    expect(html).toContain('family=Inter:wght@100..900');
  });

  it('keeps the Google link for the built-in families', () => {
    const html = file(exported(docUsing([], ['sans']), CodeTarget.Html), 'index.html');
    expect(html).toContain('family=DM+Sans');
  });

  it('says so for a font that lives only on the designer machine', () => {
    const out = exported(docUsing([local], ['Gill Sans']), CodeTarget.Html);
    expect(out.notes.join()).toContain('Gill Sans');
    expect(out.assets).toEqual([]);
  });

  it('says so when an uploaded font has no file to ship', () => {
    const out = exportCode(docUsing([upload], ['Brandon']), { target: CodeTarget.Html, name: 'Page', assets: {} });
    expect(out.notes.join()).toContain('Brandon');
  });
});
