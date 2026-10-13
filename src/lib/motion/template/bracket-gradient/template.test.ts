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
import { BRACKET_COMPONENT } from './component';
import { BRACKET_GRADIENT_TEMPLATE, BRACKET_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), BRACKET_GRADIENT_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the bracket gradient template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(BRACKET_TEMPLATE_ID)).toBe(BRACKET_GRADIENT_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = BRACKET_GRADIENT_TEMPLATE.template.doc.components[BRACKET_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes the sentence, the brackets, the gradient and the timing as typed fields', () => {
    const fields = BRACKET_GRADIENT_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'markSize')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'drift')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'headline')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'leave')?.type).toBe(FieldType.Boolean);
  });

  it('opens on a neutral sentence of its own, not the reference copy', () => {
    const placed = inserted();

    expect(templateFields(placed.doc, placed.clipId).find((f) => f.key === 'headline')?.value).toBe('Every idea deserves a clear frame');
  });

  it('names its key fields among the fields it exposes', () => {
    const keys = BRACKET_GRADIENT_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(keys).toEqual(expect.arrayContaining(BRACKET_GRADIENT_TEMPLATE.template.keyFields ?? ['missing']));
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(BRACKET_GRADIENT_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['bracket_headline', 'bracket_violet', 'bracket_mark_color', 'bracket_open_seconds']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { headline: 'zqx wide open', open_seconds: '2' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'headline')?.value).toBe('zqx wide open');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'bracket_open_seconds')?.default).toBe(2);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { bracket_headline: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('bg-mark');
  });
});
