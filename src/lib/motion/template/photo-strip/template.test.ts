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
import { STRIP_COMPONENT } from './component';
import { PHOTO_STRIP_TEMPLATE, STRIP_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), PHOTO_STRIP_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the photo strip template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(STRIP_TEMPLATE_ID)).toBe(PHOTO_STRIP_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = PHOTO_STRIP_TEMPLATE.template.doc.components[STRIP_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes photos, captions, magnifier and drag rhythm as typed fields', () => {
    const fields = PHOTO_STRIP_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'direction')).toMatchObject({ type: FieldType.Select, options: ['left', 'right'] });
    expect(fields.find((f) => f.prop === 'magnify')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'pause')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'cursor')?.type).toBe(FieldType.Boolean);
    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
  });

  it('groups the Properties panel into photos, style, motion and interaction', () => {
    const group = (prop: string) => PHOTO_STRIP_TEMPLATE.template.doc.fields.find((f) => f.prop === prop)?.group;

    expect([group('media'), group('captions')]).toEqual(['Photos', 'Photos']);
    expect([group('background'), group('cardSize'), group('font')]).toEqual(['Style', 'Style', 'Style']);
    expect([group('magnify'), group('pause'), group('direction')]).toEqual(['Motion', 'Motion', 'Motion']);
    expect([group('cursor'), group('cursorColor')]).toEqual(['Interaction', 'Interaction']);
    expect(group('drag')).toBeUndefined();
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(PHOTO_STRIP_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['strip_media', 'strip_captions', 'strip_magnify', 'strip_cursor']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { captions: 'zqx fjord', direction: 'right' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'captions')?.value).toBe('zqx fjord');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'strip_direction')?.default).toBe('right');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { strip_captions: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ps-row');
  });
});
