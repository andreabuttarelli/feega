import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml, Target } from '$lib/motion/hyperframes/compose';
import { ComponentMode, customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { stillStandIns } from '$lib/motion/custom/determinism';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { CAROUSEL_COMPONENT } from './component';
import { CAROUSEL_KEY_FIELDS, CAROUSEL_TEMPLATE_ID, CIRCULAR_CAROUSEL_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), CIRCULAR_CAROUSEL_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

const component = () => CIRCULAR_CAROUSEL_TEMPLATE.template.doc.components[CAROUSEL_COMPONENT];

describe('the circular carousel template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(CAROUSEL_TEMPLATE_ID)).toBe(CIRCULAR_CAROUSEL_TEMPLATE);
  });

  it('is live, so pointer and keys reach it on screen', () => {
    expect(component().mode).toBe(ComponentMode.Live);
  });

  it('ships clean live code whose defaults pass its own schema', () => {
    expect(lintSource(component().source, ComponentMode.Live)).toEqual([]);
    expect(customValues(component(), {}, Strictness.Strict).ok).toBe(true);
    expect(component().source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component().source.js, 'one CSS 3D scene, no WebGL context').not.toMatch(/webgl|THREE/i);
  });

  it('draws the video from t alone: it hands the runtime a still(t)', () => {
    expect(stillStandIns(inserted().doc)).toEqual([]);
  });

  it('exposes media, captions, autoplay and the background as typed fields', () => {
    const fields = CIRCULAR_CAROUSEL_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'autoplay')?.type).toBe(FieldType.Boolean);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'interval')?.type).toBe(FieldType.Number);
  });

  it('names its key fields among the fields it exposes', () => {
    const keys = CIRCULAR_CAROUSEL_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(keys).toEqual(expect.arrayContaining(CAROUSEL_KEY_FIELDS));
    expect(CIRCULAR_CAROUSEL_TEMPLATE.template.keyFields).toEqual(CAROUSEL_KEY_FIELDS);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(CIRCULAR_CAROUSEL_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['carousel_captions', 'carousel_autoplay', 'carousel_interval', 'carousel_background', 'carousel_buttons', 'carousel_drag']));
    expect(names, 'a text variable would shadow the picked media at runtime').not.toContain('carousel_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { captions: 'zqx one, zqx two', interval: '3' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'captions')?.value).toBe('zqx one, zqx two');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'carousel_interval')?.default).toBe(3);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s for video and for screen', (format) => {
    const doc = inserted(format).doc;
    const video = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, vars: { carousel_captions: 'zqx from the host' } });
    const screen = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, target: Target.Screen });

    expect(video).toContain('zqx from the host');
    expect(video).toContain('cc-ring');
    expect(screen).toContain('cc-ring');
  });
});
