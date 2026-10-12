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
import { COLLAGE_COMPONENT } from './component';
import { COLLAGE_KEY_FIELDS, COLLAGE_TEMPLATE_ID, COLLAGE_STACK_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), COLLAGE_STACK_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the collage stack template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(COLLAGE_TEMPLATE_ID)).toBe(COLLAGE_STACK_TEMPLATE);
  });

  it('ships clean, deterministic CSS component code whose defaults pass its own schema', () => {
    const component = COLLAGE_STACK_TEMPLATE.template.doc.components[COLLAGE_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js).not.toMatch(/webgl|THREE/i);
  });

  it('keeps every card a sharp rectangle', () => {
    expect(COLLAGE_STACK_TEMPLATE.template.doc.components[COLLAGE_COMPONENT].source.css).not.toMatch(/radius/);
  });

  it('exposes the word and the media as typed fields, at most five of them key', () => {
    const fields = COLLAGE_STACK_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'word')?.type).toBe(FieldType.Text);
    expect(COLLAGE_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining(COLLAGE_KEY_FIELDS));
  });

  it('groups its fields into text, media, style, cards and motion, each group in one run', () => {
    const groups = COLLAGE_STACK_TEMPLATE.template.doc.fields.map((f) => f.group).filter((g, i, all) => g !== all[i - 1]);

    expect(groups).toEqual(['Text', 'Media', 'Style', 'Cards', 'Motion']);
  });

  it('declares runtime variables, never one that would shadow the picked media', () => {
    const names = interactiveOf(COLLAGE_STACK_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['collage_word', 'collage_gap']));
    expect(names).not.toContain('collage_media');
  });

  it('takes pictures and videos from the media picker and hands them to the component', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { media: 'pic1, video:clip1', word: 'zqx cash' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const clip = instanceComp(set.doc, placed.clipId)!.comp.tracks[0].clips[0];
    const html = composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { pic1: 'https://x.test/zqx-pic.jpg', clip1: 'https://x.test/zqx-clip.mp4' } });

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(clip.props.media).toEqual([expect.objectContaining({ assetId: 'pic1', kind: 'image' }), expect.objectContaining({ assetId: 'clip1', kind: 'video' })]);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'word')?.value).toBe('zqx cash');
    expect(html).toContain('zqx-clip.mp4');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { collage_word: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('cs-world');
  });
});
