import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '@feega/motion-core/motion/doc';
import { FontSource } from '@feega/motion-core/motion/fonts/model';
import { faceRules } from '@feega/motion-core/motion/gpu-full/text/fonts';
import { localFaceCss, forgetLocalFiles } from '@feega/motion-core/motion/fonts/local-files';
import { LocalFonts, localFamilies, localFontNote, readLocalFonts, registerLocal, withPicked, FontOrigin } from './local';

const blob = () => ({ blob: async () => new Blob(['font']) });
const INSTALLED = [
  { family: 'Zapfino', style: 'Regular', ...blob() },
  { family: 'Avenir Next', style: 'Bold Italic', ...blob() },
  { family: 'Avenir Next', style: 'Regular', ...blob() }
];

afterEach(() => forgetLocalFiles());

const doc = () => newMotionDoc(MotionFormat.Landscape);

describe('local fonts', () => {
  it('reports unsupported when the browser has no Local Font Access API', async () => {
    expect(await readLocalFonts({})).toEqual({ state: LocalFonts.Unsupported });
  });

  it('reports denied when the permission prompt is refused', async () => {
    const denied = vi.fn().mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' }));

    expect(await readLocalFonts({ queryLocalFonts: denied })).toEqual({ state: LocalFonts.Denied });
  });

  it('lists installed families once each, sorted', async () => {
    const read = await readLocalFonts({ queryLocalFonts: vi.fn().mockResolvedValue(INSTALLED) });

    expect(read).toMatchObject({ state: LocalFonts.Ready, families: ['Avenir Next', 'Zapfino'] });
  });

  it('loading a family hands its files to the text renderer with weight and italic read from the style', async () => {
    const read = await readLocalFonts({ queryLocalFonts: vi.fn().mockResolvedValue(INSTALLED) });
    if (read.state !== LocalFonts.Ready) {
      throw new Error('not ready');
    }
    await read.load('Avenir Next');
    const registry = registerLocal(doc(), 'Avenir Next');
    const rules = registry.ok ? faceRules(localFaceCss(registry.doc.fonts)) : [];

    expect(rules.map((r) => [r.family, r.weight[0], r.italic]).sort()).toEqual([['Avenir Next', 400, false], ['Avenir Next', 700, true]]);
    expect(rules.every((r) => r.url.startsWith('blob:'))).toBe(true);
  });

  it('a local family never loaded draws no rules', () => {
    const registry = registerLocal(doc(), 'Avenir Next');

    expect(registry.ok && localFaceCss(registry.doc.fonts)).toBe('');
  });

  it('registers a local family flagged local and the doc still parses', () => {
    const out = registerLocal(doc(), 'Avenir Next');

    expect(out.ok).toBe(true);
    if (!out.ok) {
      return;
    }
    expect(out.doc.fonts[0]).toMatchObject({ family: 'Avenir Next', source: FontSource.Local });
    expect(parseMotionDoc(JSON.parse(JSON.stringify(out.doc)))).toMatchObject({ ok: true });
    expect(localFamilies(out.doc.fonts)).toEqual(['Avenir Next']);
  });

  it('keeps one entry when registered twice and refuses a built-in name', () => {
    const first = registerLocal(doc(), 'Avenir Next');
    const again = first.ok ? registerLocal(first.doc, 'Avenir Next') : first;

    expect(again.ok && again.doc.fonts).toHaveLength(1);
    expect(registerLocal(doc(), 'sans').ok).toBe(false);
  });

  it('a pick from the local list registers it as local', () => {
    const picked = withPicked(doc(), 'Avenir Next', FontOrigin.Local, []);

    expect(picked.doc.fonts[0].source).toBe(FontSource.Local);
    expect(picked.family).toBe('Avenir Next');
  });

  it('the export note names the local fonts and is silent without any', () => {
    const out = registerLocal(doc(), 'Avenir Next');

    expect(localFontNote(doc().fonts)).toBeNull();
    expect(out.ok && localFontNote(out.doc.fonts)).toContain('Avenir Next');
  });
});
