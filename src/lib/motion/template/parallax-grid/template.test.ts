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
import { PGRID_COMPONENT } from './component';
import { PARALLAX_GRID_TEMPLATE, PGRID_KEY_FIELDS, PGRID_TEMPLATE_ID, PGRID_TEMPLATES } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), PARALLAX_GRID_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the parallax grid template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(PGRID_TEMPLATE_ID)).toBe(PARALLAX_GRID_TEMPLATE);
  });

  it('ships one library entry per motion, differing only in the default motion', () => {
    const motionOf = (e: typeof PARALLAX_GRID_TEMPLATE) => JSON.stringify(e.template.doc).match(/"motion":"(\w+)"/)?.[1];

    expect(PGRID_TEMPLATES.map((e) => e.template.name)).toEqual(['Parallax columns', 'Alternating columns', 'Staggered columns', 'Depth columns', 'Drifting columns']);
    expect(PGRID_TEMPLATES.map(motionOf)).toEqual(['parallax', 'alternate', 'stagger', 'zoom', 'drift']);
    PGRID_TEMPLATES.forEach((e) => expect(builtinTemplate(e.id)).toBe(e));
    expect(new Set(PGRID_TEMPLATES.map((e) => e.id)).size).toBe(5);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = PARALLAX_GRID_TEMPLATE.template.doc.components[PGRID_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.css, 'sharp rectangles only').not.toMatch(/border-radius/);
  });

  it('exposes the media, the motion, the columns and the scroll as typed fields', () => {
    const fields = PARALLAX_GRID_TEMPLATE.template.doc.fields;
    const motion = fields.find((f) => f.prop === 'motion');

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(motion?.type).toBe(FieldType.Select);
    expect(motion?.options).toEqual(['parallax', 'alternate', 'stagger', 'zoom', 'drift']);
    expect(fields.find((f) => f.prop === 'scroll')?.options).toEqual(['segments', 'continuous']);
    expect(fields.find((f) => f.prop === 'columns')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
  });

  it('names its key fields among the fields it exposes', () => {
    const keys = PARALLAX_GRID_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(PGRID_KEY_FIELDS).toEqual(['media', 'motion', 'columns', 'background']);
    expect(keys).toEqual(expect.arrayContaining(PGRID_KEY_FIELDS));
    expect(PARALLAX_GRID_TEMPLATE.template.keyFields).toEqual(PGRID_KEY_FIELDS);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(PARALLAX_GRID_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['pgrid_motion', 'pgrid_columns', 'pgrid_speed', 'pgrid_background', 'pgrid_scroll']));
    expect(names, 'a text variable would shadow the picked media at runtime').not.toContain('pgrid_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { motion: 'alternate', columns: '5' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'motion')?.value).toBe('alternate');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'pgrid_columns')?.default).toBe(5);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { pgrid_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('pg-grid');
  });
});
