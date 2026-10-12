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
import { WHEEL_COMPONENT } from './component';
import { WHEEL_KEY_FIELDS, WHEEL_TEMPLATE_ID, WORD_WHEEL_UI_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), WORD_WHEEL_UI_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

const component = () => WORD_WHEEL_UI_TEMPLATE.template.doc.components[WHEEL_COMPONENT];

describe('the word wheel UI template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(WHEEL_TEMPLATE_ID)).toBe(WORD_WHEEL_UI_TEMPLATE);
  });

  it('ships clean, deterministic CSS component code whose defaults pass its own schema', () => {
    expect(lintSource(component().source)).toEqual([]);
    expect(customValues(component(), {}, Strictness.Strict).ok).toBe(true);
    expect(component().source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component().source.js).not.toMatch(/webgl|THREE/i);
  });

  it('keeps every shape a sharp rectangle or a full circle', () => {
    const radii = component().source.css.match(/border-radius:[^;]+/g) ?? [];

    radii.forEach((r) => expect(r).toMatch(/9999px|50%/));
  });

  it('exposes the words and the panel picture as typed fields, at most five of them key', () => {
    const fields = WORD_WHEEL_UI_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'words')?.type).toBe(FieldType.Text);
    expect(WHEEL_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining(WHEEL_KEY_FIELDS));
  });

  it('groups its fields into text, panel, media, style, camera and motion, each group in one run', () => {
    const groups = WORD_WHEEL_UI_TEMPLATE.template.doc.fields.map((f) => f.group).filter((g, i, all) => g !== all[i - 1]);

    expect(groups).toEqual(['Text', 'Panel', 'Media', 'Style', 'Camera', 'Motion']);
  });

  it('declares runtime variables, never one that would shadow the picked media', () => {
    const names = interactiveOf(WORD_WHEEL_UI_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['wheel_words', 'wheel_accent']));
    expect(names).not.toContain('wheel_media');
  });

  it('takes a picture from the media picker and hands it to the panel', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { media: 'pic1', words: 'zqx, qqv, wwk' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const clip = instanceComp(set.doc, placed.clipId)!.comp.tracks[0].clips[0];
    const html = composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { pic1: 'https://x.test/zqx-pic.jpg' } });

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(clip.props.media).toEqual([expect.objectContaining({ assetId: 'pic1', kind: 'image' })]);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'words')?.value).toBe('zqx, qqv, wwk');
    expect(html).toContain('zqx-pic.jpg');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { wheel_words: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ww-wheel');
  });
});
