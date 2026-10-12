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
import { PHONE_COMPONENT } from './component';
import { PHONE_SPLIT_TEMPLATE, PHONE_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), PHONE_SPLIT_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the phone split template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(PHONE_TEMPLATE_ID)).toBe(PHONE_SPLIT_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = PHONE_SPLIT_TEMPLATE.template.doc.components[PHONE_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes the headline, the split, the device and the timing as typed fields', () => {
    const fields = PHONE_SPLIT_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'gap')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'finish')?.type).toBe(FieldType.Select);
    expect(fields.find((f) => f.prop === 'splitAt')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'headline')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'tilt')?.type).toBe(FieldType.Boolean);
  });

  it('names its key fields among the fields it exposes', () => {
    const keys = PHONE_SPLIT_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(keys).toEqual(expect.arrayContaining(PHONE_SPLIT_TEMPLATE.template.keyFields ?? ['missing']));
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(PHONE_SPLIT_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['phone_headline', 'phone_split_at', 'phone_rise_seconds']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { headline: 'zqx wide open', gap: '0.6' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'headline')?.value).toBe('zqx wide open');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'phone_gap')?.default).toBe(0.6);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { phone_headline: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ps-phone');
  });
});

describe('the phone split device', () => {
  it('carries no brand name or logo of a real phone maker', () => {
    const code = JSON.stringify(PHONE_SPLIT_TEMPLATE.template.doc);

    expect(code).not.toMatch(/iphone|apple|samsung|galaxy|pixel/i);
  });
});

describe('the phone split screen and properties', () => {
  it('puts the picked picture on the screen: no runtime variable overrides the media list', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { media: 'zqxphoto' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const html = composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { zqxphoto: 'data:image/png;base64,zqxbytes' }, vars: {} });

    expect(html).toContain('zqxbytes');
    expect(interactiveOf(set.doc).vars.map((v) => v.name)).not.toContain('phone_media');
  });

  it('groups the device controls together in the properties', () => {
    const fields = PHONE_SPLIT_TEMPLATE.template.doc.fields;

    ['finish', 'phoneHeight', 'shadow', 'tilt', 'tiltDegrees', 'screenAccent'].forEach((prop) => expect(fields.find((f) => f.prop === prop)?.group).toBe('Device'));
  });
});
