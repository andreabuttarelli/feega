import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { PAPER_COMPONENT } from './component';
import { PAPER_CUTOUTS_TEMPLATE, PAPER_KEY_FIELDS, PAPER_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), PAPER_CUTOUTS_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the paper cutouts counter template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(PAPER_TEMPLATE_ID)).toBe(PAPER_CUTOUTS_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = PAPER_CUTOUTS_TEMPLATE.template.doc.components[PAPER_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js, 'CSS 3D only, no WebGL context').not.toMatch(/webgl|THREE/i);
  });

  it('exposes the counter, media, labels and colours as typed fields', () => {
    const fields = PAPER_CUTOUTS_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'from')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'brand')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'panelColor')?.type).toBe(FieldType.Color);
  });

  it('names at most five key fields, all among the fields it exposes', () => {
    const keys = PAPER_CUTOUTS_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(PAPER_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(keys).toEqual(expect.arrayContaining(PAPER_KEY_FIELDS));
    expect(PAPER_CUTOUTS_TEMPLATE.template.keyFields).toEqual(PAPER_KEY_FIELDS);
  });

  it('groups its fields into text, counter, media, labels, style, paper and motion', () => {
    const groups = [...new Set(PAPER_CUTOUTS_TEMPLATE.template.doc.fields.map((f) => f.group))];

    expect(groups).toEqual(['Text', 'Counter', 'Media', 'Labels', 'Style', 'Paper', 'Motion']);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(PAPER_CUTOUTS_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['paper_from', 'paper_to', 'paper_brand', 'paper_panel_color']));
    expect(names, 'a text variable would shadow the picked media at runtime').not.toContain('paper_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { brand: 'zqx', to: '900000' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'brand')?.value).toBe('zqx');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'paper_to')?.default).toBe(900000);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { paper_brand: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('pp-stage');
  });
});
