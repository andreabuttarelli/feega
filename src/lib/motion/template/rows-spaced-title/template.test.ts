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
import { ROWS_COMPONENT } from './component';
import { ROWS_SPACED_TITLE_TEMPLATE, ROWS_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), ROWS_SPACED_TITLE_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the rows and spaced title template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(ROWS_TEMPLATE_ID)).toBe(ROWS_SPACED_TITLE_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = ROWS_SPACED_TITLE_TEMPLATE.template.doc.components[ROWS_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes title, photos, colours and motion as typed fields', () => {
    const field = (prop: string) => ROWS_SPACED_TITLE_TEMPLATE.template.doc.fields.find((f) => f.prop === prop);

    expect(field('direction')).toMatchObject({ type: FieldType.Select, options: ['left', 'right'] });
    expect(field('media')?.type).toBe(FieldType.MediaList);
    expect(field('background')?.type).toBe(FieldType.Color);
    expect(field('speed')?.type).toBe(FieldType.Number);
    expect([field('media')?.group, field('speed')?.group, field('title')?.group]).toEqual(['Photos', 'Motion', 'Text']);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(ROWS_SPACED_TITLE_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['rows_title', 'rows_speed', 'rows_direction']));
    expect(names).not.toContain('rows_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx now', direction: 'right' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx now');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'rows_direction')?.default).toBe('right');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { rows_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('rst-row');
  });
});
