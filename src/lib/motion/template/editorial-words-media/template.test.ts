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
import { EDITORIAL_COMPONENT } from './component';
import { EDITORIAL_TEMPLATE_ID, EDITORIAL_WORDS_MEDIA_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), EDITORIAL_WORDS_MEDIA_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the editorial words and media template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(EDITORIAL_TEMPLATE_ID)).toBe(EDITORIAL_WORDS_MEDIA_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = EDITORIAL_WORDS_MEDIA_TEMPLATE.template.doc.components[EDITORIAL_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes phrases, media, colours and rhythm as typed, grouped fields', () => {
    const field = (prop: string) => EDITORIAL_WORDS_MEDIA_TEMPLATE.template.doc.fields.find((f) => f.prop === prop);

    expect(field('media')?.type).toBe(FieldType.MediaList);
    expect(field('background')?.type).toBe(FieldType.Color);
    expect(field('quote')?.type).toBe(FieldType.Boolean);
    expect(field('beat')?.type).toBe(FieldType.Number);
    expect([field('phrases')?.group, field('quote')?.group, field('beat')?.group]).toEqual(['Text', 'Text', 'Motion']);
    expect(EDITORIAL_WORDS_MEDIA_TEMPLATE.template.keyFields.length).toBeLessThanOrEqual(5);
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { phrases: 'zqx / fjord', quote: 'false' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'phrases')?.value).toBe('zqx / fjord');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'editorial_quote')?.default).toBe(false);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { editorial_phrases: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ew-media');
  });
});
