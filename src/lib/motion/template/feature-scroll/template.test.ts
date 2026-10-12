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
import { SCROLL_COMPONENT } from './component';
import { FEATURE_SCROLL_TEMPLATE, SCROLL_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), FEATURE_SCROLL_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the feature scroll template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(SCROLL_TEMPLATE_ID)).toBe(FEATURE_SCROLL_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = FEATURE_SCROLL_TEMPLATE.template.doc.components[SCROLL_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes the titles, the list, the alignment and the speed as typed fields', () => {
    const fields = FEATURE_SCROLL_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'align')).toMatchObject({ type: FieldType.Select, options: ['center', 'left'] });
    expect(fields.find((f) => f.prop === 'readSpeed')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'lines')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'leave')?.type).toBe(FieldType.Boolean);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(FEATURE_SCROLL_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['scroll_open_title', 'scroll_close_title', 'scroll_lines', 'scroll_read_speed']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { open_title: 'zqx all of it', align: 'left' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'open_title')?.value).toBe('zqx all of it');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'scroll_align')?.default).toBe('left');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { scroll_open_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('fs-column');
  });
});
