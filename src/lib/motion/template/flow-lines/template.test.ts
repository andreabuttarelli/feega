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
import { FLOW_COMPONENT } from './component';
import { FLOW_KEY_FIELDS, FLOW_LINES_TEMPLATE, FLOW_TEMPLATE_ID } from './template';

const MAX_KEY_FIELDS = 5;

const inserted = (format = MotionFormat.Vertical) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), FLOW_LINES_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the flow lines template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(FLOW_TEMPLATE_ID)).toBe(FLOW_LINES_TEMPLATE);
  });

  it('ships clean component code whose defaults pass its own schema', () => {
    const component = FLOW_LINES_TEMPLATE.template.doc.components[FLOW_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('draws on the one shared renderer and hands the export a still for any time', () => {
    const js = FLOW_LINES_TEMPLATE.template.doc.components[FLOW_COMPONENT].source.js;

    expect(js.match(/three\.renderer\(/g)).toHaveLength(1);
    expect(js).not.toMatch(/getContext\(/);
    expect(js).not.toMatch(/requestAnimationFrame|Math\.random|Date\.now|performance\.now/);
    expect(js).toMatch(/\breturn\s*\{[^}]*\bstill\b/);
  });

  it('exposes line colour, background, density, turbulence, speed and the title as typed fields', () => {
    const fields = FLOW_LINES_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'lineColor')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'density')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'turbulence')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'speed')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'title')?.type).toBe(FieldType.Text);
  });

  it('names at most five key fields, all among the fields it exposes', () => {
    const keys = FLOW_LINES_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(FLOW_KEY_FIELDS.length).toBeLessThanOrEqual(MAX_KEY_FIELDS);
    expect(keys).toEqual(expect.arrayContaining(FLOW_KEY_FIELDS));
    expect(FLOW_LINES_TEMPLATE.template.keyFields).toEqual(FLOW_KEY_FIELDS);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(FLOW_LINES_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['flow_title', 'flow_line_color', 'flow_background', 'flow_density', 'flow_turbulence', 'flow_speed']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx current', density: '0.3' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx current');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'flow_density')?.default).toBe(0.3);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { flow_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('fl-canvas');
  });
});
