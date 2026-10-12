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
import { GLOBE_COMPONENT } from './component';
import { GLOBE_KEY_FIELDS, GLOBE_TEMPLATE_ID, IMAGE_GLOBE_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), IMAGE_GLOBE_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the image globe template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(GLOBE_TEMPLATE_ID)).toBe(IMAGE_GLOBE_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = IMAGE_GLOBE_TEMPLATE.template.doc.components[GLOBE_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js, 'one CSS 3D scene, no WebGL context').not.toMatch(/webgl|THREE/i);
  });

  it('exposes the media, the title, the globe and its turn as typed fields', () => {
    const fields = IMAGE_GLOBE_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'turns')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'title')?.type).toBe(FieldType.Text);
  });

  it('names its key fields among the fields it exposes', () => {
    const keys = IMAGE_GLOBE_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(keys).toEqual(expect.arrayContaining(GLOBE_KEY_FIELDS));
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(IMAGE_GLOBE_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['globe_title', 'globe_turns', 'globe_background', 'globe_tiles']));
    expect(names, 'a text variable would shadow the picked media at runtime').not.toContain('globe_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx round', turns: '2' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx round');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'globe_turns')?.default).toBe(2);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { globe_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ig-globe');
  });
});
