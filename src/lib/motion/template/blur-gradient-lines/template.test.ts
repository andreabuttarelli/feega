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
import { BLUR_LINES_COMPONENT } from './component';
import { BLUR_GRADIENT_LINES_TEMPLATE, BLUR_LINES_KEY_FIELDS, BLUR_LINES_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), BLUR_GRADIENT_LINES_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the blur gradient lines template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(BLUR_LINES_TEMPLATE_ID)).toBe(BLUR_GRADIENT_LINES_TEMPLATE);
  });

  it('ships clean, deterministic CSS-only component code whose defaults pass its own schema', () => {
    const component = BLUR_GRADIENT_LINES_TEMPLATE.template.doc.components[BLUR_LINES_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js).not.toMatch(/webgl|THREE/i);
  });

  it('exposes the text, the picture and the gradient as typed fields', () => {
    const fields = BLUR_GRADIENT_LINES_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'text')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'topColor')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'blur')?.type).toBe(FieldType.Number);
  });

  it('names at most five key fields, all among the fields it exposes', () => {
    const keys = BLUR_GRADIENT_LINES_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(BLUR_LINES_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(keys).toEqual(expect.arrayContaining(BLUR_LINES_KEY_FIELDS));
    expect(BLUR_GRADIENT_LINES_TEMPLATE.template.keyFields).toEqual(BLUR_LINES_KEY_FIELDS);
  });

  it('groups its fields into text, media, style, shape, lines and motion', () => {
    const groups = [...new Set(BLUR_GRADIENT_LINES_TEMPLATE.template.doc.fields.map((f) => f.group))];

    expect(groups).toEqual(['Text', 'Media', 'Style', 'Lines', 'Shape', 'Motion']);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(BLUR_GRADIENT_LINES_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['blurlines_text', 'blurlines_top_color', 'blurlines_bottom_color']));
    expect(names).not.toContain('blurlines_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { text: 'zqx typed', top_color: '#123456' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'text')?.value).toBe('zqx typed');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'blurlines_top_color')?.default).toBe('#123456');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { blurlines_text: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('bgl-shape');
  });
});
