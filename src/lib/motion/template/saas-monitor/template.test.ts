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
import { MOCKUP_COMPONENT } from './component';
import { MOCKUP_KEY_FIELDS, MOCKUP_TEMPLATE_ID, SAAS_MONITOR_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), SAAS_MONITOR_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the saas monitor template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(MOCKUP_TEMPLATE_ID)).toBe(SAAS_MONITOR_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = SAAS_MONITOR_TEMPLATE.template.doc.components[MOCKUP_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('names its key fields among the fields it exposes', () => {
    const placed = inserted();
    const keys = templateFields(placed.doc, placed.clipId).map((f) => f.key);

    expect(keys).toEqual(expect.arrayContaining(MOCKUP_KEY_FIELDS));
  });

  it('exposes the screen source, the finish and the accent as typed fields', () => {
    const fields = SAAS_MONITOR_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'screenSource')).toMatchObject({ type: FieldType.Select, options: ['site', 'asset'] });
    expect(fields.find((f) => f.prop === 'finish')).toMatchObject({ type: FieldType.Select, options: ['black', 'silver'] });
    expect(fields.find((f) => f.prop === 'accent')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'leave')?.type).toBe(FieldType.Boolean);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(SAAS_MONITOR_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['mockup_watermark', 'mockup_headline', 'mockup_accent', 'mockup_screen_source']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { watermark: 'zqx studio', finish: 'silver' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'watermark')?.value).toBe('zqx studio');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'mockup_finish')?.default).toBe('silver');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { mockup_headline: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('sm-rig');
  });
});
