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
import { FLOAT_COMPONENT } from './component';
import { FLOATING_MEDIA_TEMPLATE, FLOAT_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), FLOATING_MEDIA_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the floating media template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(FLOAT_TEMPLATE_ID)).toBe(FLOATING_MEDIA_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = FLOATING_MEDIA_TEMPLATE.template.doc.components[FLOAT_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes the title, the media, the layout and the drift as typed fields', () => {
    const fields = FLOATING_MEDIA_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'layout')).toMatchObject({ type: FieldType.Select, options: ['orbit', 'cloud', 'grid-depth'] });
    expect(fields.find((f) => f.prop === 'resistance')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'background')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
  });

  it('groups its fields into text, media, style and motion, in that order', () => {
    const groups = [...new Set(FLOATING_MEDIA_TEMPLATE.template.doc.fields.map((f) => f.group))];

    expect(groups).toEqual(['Text', 'Media', 'Style', 'Motion']);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(FLOATING_MEDIA_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['float_title', 'float_media', 'float_drift', 'float_resistance']));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx slow water', layout: 'cloud' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx slow water');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'float_layout')?.default).toBe('cloud');
  });

  it('takes pictures and videos from the media picker and hands them to the component', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { media: 'pic1, video:clip1' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const component = set.doc.components[FLOAT_COMPONENT];
    const clip = instanceComp(set.doc, placed.clipId)!.comp.tracks[0].clips[0];
    const html = composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { pic1: 'https://x.test/zqx-pic.jpg', clip1: 'https://x.test/zqx-clip.mp4' } });

    expect(clip.props.media).toEqual([expect.objectContaining({ assetId: 'pic1', kind: 'image' }), expect.objectContaining({ assetId: 'clip1', kind: 'video' })]);
    const { name: _name, ...values } = clip.props;

    expect(customValues(component, values, Strictness.Strict).ok).toBe(true);
    expect(html).toContain('zqx-clip.mp4');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { float_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('fm-world');
  });
});
