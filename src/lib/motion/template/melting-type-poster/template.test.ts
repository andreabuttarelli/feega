import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, instanceComp, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { MELT_COMPONENT } from './component';
import { MELT_KEY_FIELDS, MELT_TEMPLATE_ID, MELTING_TYPE_POSTER_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), MELTING_TYPE_POSTER_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the melting type poster template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(MELT_TEMPLATE_ID)).toBe(MELTING_TYPE_POSTER_TEMPLATE);
  });

  it('ships clean, deterministic CSS component code whose defaults pass its own schema', () => {
    const component = MELTING_TYPE_POSTER_TEMPLATE.template.doc.components[MELT_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js).not.toMatch(/webgl|THREE/i);
  });

  it('keeps every shape a sharp rectangle', () => {
    expect(MELTING_TYPE_POSTER_TEMPLATE.template.doc.components[MELT_COMPONENT].source.css).not.toMatch(/radius/);
  });

  it('exposes the editable text as typed fields, at most five of them key', () => {
    const fields = MELTING_TYPE_POSTER_TEMPLATE.template.doc.fields;

    ['title', 'subtitle', 'index', 'kicker', 'body_left', 'body_mid', 'body_right', 'footer', 'credit'].forEach((key) => expect(fields.find((f) => f.key === key)?.type).toBe(FieldType.Text));
    expect(MELT_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining(MELT_KEY_FIELDS));
  });

  it('groups its fields into text, body, style and motion, each group in one run', () => {
    const groups = MELTING_TYPE_POSTER_TEMPLATE.template.doc.fields.map((f) => f.group).filter((g, i, all) => g !== all[i - 1]);

    expect(groups).toEqual(['Text', 'Body', 'Style', 'Motion']);
  });

  it('declares runtime variables for the titles and the melt', () => {
    const names = interactiveOf(MELTING_TYPE_POSTER_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['melt_title', 'melt_strength']));
  });

  it('takes a new title from the field', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx poster' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx poster');
    expect(instanceComp(set.doc, placed.clipId)!.comp.tracks[0].clips[0].props.title).toBe('zqx poster');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { melt_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('mt-page');
  });
});
