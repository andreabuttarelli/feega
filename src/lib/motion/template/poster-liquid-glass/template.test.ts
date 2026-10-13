import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintAdvice, lintSource } from '$lib/motion/custom/lint';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { POSTER_GLASS_COMPONENT } from './component';
import { POSTER_GLASS_KEY_FIELDS, POSTER_GLASS_TEMPLATE_ID, POSTER_LIQUID_GLASS_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), POSTER_LIQUID_GLASS_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

const component = () => POSTER_LIQUID_GLASS_TEMPLATE.template.doc.components[POSTER_GLASS_COMPONENT];

describe('the poster liquid glass template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(POSTER_GLASS_TEMPLATE_ID)).toBe(POSTER_LIQUID_GLASS_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    expect(lintSource(component().source)).toEqual([]);
    expect(customValues(component(), {}, Strictness.Strict).ok).toBe(true);
    expect(component().source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('refracts with one renderer, freed on destroy', () => {
    expect(lintAdvice(component().source)).toEqual([]);
    expect(component().source.js.match(/three\.renderer\(/g)).toHaveLength(1);
  });

  it('keeps the poster a sharp rectangle', () => {
    expect(component().source.css).not.toMatch(/radius|rotate/);
  });

  it('exposes every text block as a text field, at most five of them key', () => {
    const fields = POSTER_LIQUID_GLASS_TEMPLATE.template.doc.fields;

    for (const prop of ['headline', 'intro', 'details', 'dates', 'venue', 'footer']) {
      expect(fields.find((f) => f.prop === prop)?.type).toBe(FieldType.Text);
    }
    expect(POSTER_GLASS_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining(POSTER_GLASS_KEY_FIELDS));
  });

  it('groups its fields into text, style, glass and motion, each group in one run', () => {
    const groups = POSTER_LIQUID_GLASS_TEMPLATE.template.doc.fields.map((f) => f.group).filter((g, i, all) => g !== all[i - 1]);

    expect(groups).toEqual(['Text', 'Style', 'Glass', 'Motion']);
  });

  it('declares the words and colours as runtime variables', () => {
    const names = interactiveOf(POSTER_LIQUID_GLASS_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['poster_headline', 'poster_dates', 'poster_ink']));
  });

  it('takes an edited headline through the fields', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { headline: 'zqx' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'headline')?.value).toBe('zqx');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square, MotionFormat.Portrait])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { poster_headline: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('plg-canvas');
  });
});
