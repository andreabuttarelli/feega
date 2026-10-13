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
import { RIBBON_COMPONENT } from './component';
import { PARTICLE_RIBBON_TEMPLATE, RIBBON_KEY_FIELDS, RIBBON_TEMPLATE_ID } from './template';

const MAX_KEY_FIELDS = 5;

const inserted = (format = MotionFormat.Vertical) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), PARTICLE_RIBBON_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the particle ribbon template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(RIBBON_TEMPLATE_ID)).toBe(PARTICLE_RIBBON_TEMPLATE);
  });

  it('ships clean, deterministic component code on one GPU renderer, with no advice left', () => {
    const component = PARTICLE_RIBBON_TEMPLATE.template.doc.components[RIBBON_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(lintAdvice(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js.match(/three\.renderer\(/g)).toHaveLength(1);
    expect(component.source.js).toMatch(/return \{ still/);
  });

  it('exposes the gradient, background, density, speed and title as typed fields', () => {
    const fields = PARTICLE_RIBBON_TEMPLATE.template.doc.fields;
    const type = (key: string) => fields.find((f) => f.key === key)?.type;

    ['color_a', 'color_b', 'color_c', 'color_d', 'background'].forEach((key) => expect(type(key)).toBe(FieldType.Color));
    expect(type('density')).toBe(FieldType.Number);
    expect(type('speed')).toBe(FieldType.Number);
    expect(type('title')).toBe(FieldType.Text);
  });

  it('names at most five key fields, all among the fields it exposes', () => {
    const keys = PARTICLE_RIBBON_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(RIBBON_KEY_FIELDS.length).toBeLessThanOrEqual(MAX_KEY_FIELDS);
    expect(keys).toEqual(expect.arrayContaining(RIBBON_KEY_FIELDS));
    expect(PARTICLE_RIBBON_TEMPLATE.template.keyFields).toEqual(RIBBON_KEY_FIELDS);
  });

  it('declares runtime variables under its own prefix', () => {
    const names = interactiveOf(PARTICLE_RIBBON_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['ribbon_title', 'ribbon_background', 'ribbon_color_a', 'ribbon_density', 'ribbon_speed']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx grain', density: '800' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx grain');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'ribbon_density')?.default).toBe(800);
  });

  it('an emptied title field clears the title everywhere it is read', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: '' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'ribbon_title')?.default).toBe('');
    expect(composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: {} })).not.toContain('made of motion');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with three.js and the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { ribbon_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('pr-canvas');
    expect(html).toMatch(/three/i);
  });
});
