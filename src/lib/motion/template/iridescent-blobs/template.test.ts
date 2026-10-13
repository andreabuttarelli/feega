import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintAdvice, lintSource } from '$lib/motion/custom/lint';
import { stillStandIns } from '$lib/motion/custom/determinism';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { webglPerLane } from '$lib/motion/export/webgl-budget';
import { builtinTemplate } from '../builtins';
import { insertTemplate, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { BLOBS_COMPONENT } from './component';
import { BLOBS_KEY_FIELDS, BLOBS_TEMPLATE_ID, IRIDESCENT_BLOBS_TEMPLATE } from './template';

const MAX_KEY_FIELDS = 5;

const inserted = (format = MotionFormat.Vertical) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), IRIDESCENT_BLOBS_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the iridescent blobs template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(BLOBS_TEMPLATE_ID)).toBe(IRIDESCENT_BLOBS_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = IRIDESCENT_BLOBS_TEMPLATE.template.doc.components[BLOBS_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('draws on one shared renderer it frees, within the GPU advice', () => {
    const component = IRIDESCENT_BLOBS_TEMPLATE.template.doc.components[BLOBS_COMPONENT];

    expect(component.source.js).toContain('three.renderer(');
    expect(lintAdvice(component.source)).toEqual([]);
  });

  it('draws the video from t alone: it hands the runtime a still(t)', () => {
    expect(stillStandIns(inserted().doc)).toEqual([]);
  });

  it('exposes the palette, the bubbles and the speed as typed fields', () => {
    const fields = IRIDESCENT_BLOBS_TEMPLATE.template.doc.fields;

    ['body', 'rim', 'glow'].forEach((prop) => expect(fields.find((f) => f.prop === prop)?.type).toBe(FieldType.Color));
    expect(fields.find((f) => f.prop === 'bubbles')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'speed')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'title')?.type).toBe(FieldType.Text);
  });

  it('names at most five key fields, all among the fields it exposes', () => {
    const keys = IRIDESCENT_BLOBS_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(BLOBS_KEY_FIELDS.length).toBeLessThanOrEqual(MAX_KEY_FIELDS);
    expect(keys).toEqual(expect.arrayContaining(BLOBS_KEY_FIELDS));
    expect(IRIDESCENT_BLOBS_TEMPLATE.template.keyFields).toEqual(BLOBS_KEY_FIELDS);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(IRIDESCENT_BLOBS_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['blobs_title', 'blobs_body', 'blobs_rim', 'blobs_glow', 'blobs_bubbles', 'blobs_speed']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx matter', bubbles: '0.2' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx matter');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'blobs_bubbles')?.default).toBe(0.2);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s on one WebGL context', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { blobs_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ib-canvas');
    expect(webglPerLane(html)).toBe(1);
  });
});
