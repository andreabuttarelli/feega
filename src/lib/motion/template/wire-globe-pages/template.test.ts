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
import { WIRE_COMPONENT } from './component';
import { WIRE_KEY_FIELDS, WIRE_TEMPLATE_ID, WIRE_GLOBE_PAGES_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), WIRE_GLOBE_PAGES_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the wire globe pages template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(WIRE_TEMPLATE_ID)).toBe(WIRE_GLOBE_PAGES_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = WIRE_GLOBE_PAGES_TEMPLATE.template.doc.components[WIRE_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js.match(/three\.renderer\(/g), 'one WebGL renderer').toHaveLength(1);
  });

  it('exposes the pages, the look and the turn as typed fields', () => {
    const fields = WIRE_GLOBE_PAGES_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'monochrome')?.type).toBe(FieldType.Boolean);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'turns')?.type).toBe(FieldType.Number);
  });

  it('names at most five key fields, all among the fields it exposes', () => {
    const keys = WIRE_GLOBE_PAGES_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(keys).toEqual(expect.arrayContaining(WIRE_KEY_FIELDS));
    expect(WIRE_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(WIRE_GLOBE_PAGES_TEMPLATE.template.keyFields).toEqual(WIRE_KEY_FIELDS);
  });

  it('groups its fields into media, style, globe, camera and motion', () => {
    const groups = [...new Set(WIRE_GLOBE_PAGES_TEMPLATE.template.doc.fields.map((f) => f.group))];

    expect(groups).toEqual(['Media', 'Style', 'Globe', 'Camera', 'Motion']);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(WIRE_GLOBE_PAGES_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['wire_background', 'wire_turns', 'wire_monochrome', 'wire_pages']));
    expect(names, 'a text variable would shadow the picked media at runtime').not.toContain('wire_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { turns: '2' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'turns')?.value).toBe(2);
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'wire_turns')?.default).toBe(2);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { wire_background: '#123456' } });

    expect(html).toContain('#123456');
    expect(html).toContain('wg-canvas');
  });
});
