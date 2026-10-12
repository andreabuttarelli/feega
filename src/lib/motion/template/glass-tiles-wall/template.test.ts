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
import { GTW_COMPONENT } from './component';
import { GLASS_TILES_WALL_TEMPLATE, GTW_KEY_FIELDS, GTW_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), GLASS_TILES_WALL_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the glass tiles wall template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(GTW_TEMPLATE_ID)).toBe(GLASS_TILES_WALL_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = GLASS_TILES_WALL_TEMPLATE.template.doc.components[GTW_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes the media, titles and captions as typed fields, and at most five key fields', () => {
    const fields = GLASS_TILES_WALL_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'titles')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(GTW_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining(GTW_KEY_FIELDS));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { curve: '1.4' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'curve')?.value).toBe(1.4);
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'gtw_curve')?.default).toBe(1.4);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { gtw_titles: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('gt-canvas');
  });
});
