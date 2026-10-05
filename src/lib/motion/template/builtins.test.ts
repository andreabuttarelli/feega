import { describe, expect, it } from 'vitest';
import { LAYOUTS } from '$lib/canvas/composition/index';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { BUILTIN_TEMPLATES, builtinTemplate } from './builtins';
import { insertTemplate, setTemplateValues, templateFields } from './library';
import { FieldType } from './field-model';

const ids = () => {
  let n = 0;
  return () => `b${++n}`;
};

describe('built-in motion templates', () => {
  it('every composition node layout is a template, so motion uses the same compositions as the canvas', () => {
    const layouts = BUILTIN_TEMPLATES.filter((e) => e.template.doc.tracks.some((t) => t.clips.some((c) => c.component === 'Composition'))).map((e) => e.template.doc.tracks[0].clips[0].props.layout);

    expect(layouts.sort()).toEqual(Object.keys(LAYOUTS).sort());
  });

  it('a composition template exposes every setting of its layout: speed, shape, colours', () => {
    for (const layout of Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]) {
      const entry = builtinTemplate(`builtin:composition-${layout}`)!;
      const props = entry.template.doc.fields.map((f) => f.prop);

      expect(props).toEqual(expect.arrayContaining(LAYOUTS[layout].params.map((p) => `layoutParams.${p.name}`)));
    }
  });

  it('ships the designed ones too', () => {
    const designed = ['lower-third', 'title-card', 'product-reveal', 'end-card', 'social-stat', 'quote'];

    expect(designed.every((id) => builtinTemplate(`builtin:${id}`))).toBe(true);
  });

  it.each(BUILTIN_TEMPLATES.map((e) => [e.id, e] as const))('%s is a valid doc with typed fields, inserts into any format and composes', (_id, entry) => {
    expect(parseMotionDoc(entry.template.doc).ok).toBe(true);
    expect(entry.template.doc.fields.length).toBeGreaterThan(0);

    const placed = insertTemplate(newMotionDoc(MotionFormat.Vertical), entry, { from: 0, newId: ids() });

    expect(placed.ok && parseMotionDoc(placed.doc).ok).toBe(true);
    expect(placed.ok && composeHtml({ doc: placed.doc, tokens: FEEGA_TOKENS, assets: {} })).toContain('data-composition-id="main"');
  });

  it('a media slot says the aspect its picture is cropped to', () => {
    const reveal = builtinTemplate('builtin:product-reveal');

    expect(reveal?.template.doc.fields.find((f) => f.type === FieldType.Asset)?.aspect).toBeGreaterThan(0);
  });

  it('the lower third takes a name and a role and shows them', () => {
    const entry = builtinTemplate('builtin:lower-third');
    const placed = entry ? insertTemplate(newMotionDoc(MotionFormat.Landscape), entry, { from: 0, newId: ids() }) : null;
    const filled = placed?.ok ? setTemplateValues(placed.doc, placed.clipId, { name: 'Zqx Ada Lovelace', role: 'Zqx Engineer' }) : null;

    expect(placed?.ok && templateFields(placed.doc, placed.clipId).map((f) => f.key)).toEqual(expect.arrayContaining(['name', 'role', 'accent']));
    const html = filled?.ok ? composeHtml({ doc: filled.doc, tokens: FEEGA_TOKENS, assets: {} }) : '';
    expect(html).toContain('Zqx Ada Lovelace');
    expect(html).toContain('Zqx Engineer');
  });
});
