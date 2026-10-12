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
import { RGB_COMPONENT } from './component';
import { RGB_TEMPLATE_ID, RGB_SPLIT_TITLE_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), RGB_SPLIT_TITLE_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the rgb split title template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(RGB_TEMPLATE_ID)).toBe(RGB_SPLIT_TITLE_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = RGB_SPLIT_TITLE_TEMPLATE.template.doc.components[RGB_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes title, media, colours and motion as typed, grouped fields', () => {
    const field = (prop: string) => RGB_SPLIT_TITLE_TEMPLATE.template.doc.fields.find((f) => f.prop === prop);

    expect(field('media')?.type).toBe(FieldType.MediaList);
    expect(field('background')?.type).toBe(FieldType.Color);
    expect(field('split')?.type).toBe(FieldType.Number);
    expect([field('title')?.group, field('split')?.group, field('settle')?.group]).toEqual(['Text', 'Motion', 'Motion']);
    expect(RGB_SPLIT_TITLE_TEMPLATE.template.keyFields?.length ?? 0).toBeLessThanOrEqual(5);
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx fjord', split: '0.05' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx fjord');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'rgbsplit_split')?.default).toBe(0.05);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { rgbsplit_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('rs-channel');
  });
});
