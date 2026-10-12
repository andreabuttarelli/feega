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
import { SPLIT_COMPONENT } from './component';
import { SPLIT_HEADLINE_TEMPLATE, SPLIT_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), SPLIT_HEADLINE_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the split headline template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(SPLIT_TEMPLATE_ID)).toBe(SPLIT_HEADLINE_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = SPLIT_HEADLINE_TEMPLATE.template.doc.components[SPLIT_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes the headline, the split, the image and the timing as typed fields', () => {
    const fields = SPLIT_HEADLINE_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'radius')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'splitAt')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'headline')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'innerZoom')?.type).toBe(FieldType.Boolean);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(SPLIT_HEADLINE_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['split_headline', 'split_split_at', 'split_media', 'split_open_seconds']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { headline: 'zqx wide open', radius: '50' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'headline')?.value).toBe('zqx wide open');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'split_radius')?.default).toBe(50);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { split_headline: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('sh-media');
  });
});
