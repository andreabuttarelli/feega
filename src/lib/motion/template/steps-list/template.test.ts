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
import { STEPS_COMPONENT } from './component';
import { STEPS_LIST_TEMPLATE, STEPS_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), STEPS_LIST_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the steps list template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(STEPS_TEMPLATE_ID)).toBe(STEPS_LIST_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = STEPS_LIST_TEMPLATE.template.doc.components[STEPS_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes text, colours and motion as typed fields', () => {
    const field = (prop: string) => STEPS_LIST_TEMPLATE.template.doc.fields.find((f) => f.prop === prop);

    expect(field('steps')?.type).toBe(FieldType.Text);
    expect(field('accent1')?.type).toBe(FieldType.Color);
    expect(field('pace')?.type).toBe(FieldType.Number);
    expect([field('heading')?.group, field('accent2')?.group, field('pace')?.group]).toEqual(['Text', 'Icons', 'Motion']);
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { heading: 'zqx now' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'heading')?.value).toBe('zqx now');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'steps_heading')?.default).toBe('zqx now');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { steps_heading: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('stl-steps');
  });
});
