import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { interactiveOf, PlayMode } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { STORY_COMPONENT } from './component';
import { SCROLL_STORY_TEMPLATE, STORY_SCROLL_LENGTH, STORY_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), SCROLL_STORY_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the scroll story template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(STORY_TEMPLATE_ID)).toBe(SCROLL_STORY_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = SCROLL_STORY_TEMPLATE.template.doc.components[STORY_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes three chapters, the grid and the swap as typed fields', () => {
    const fields = SCROLL_STORY_TEMPLATE.template.doc.fields;

    expect(fields.filter((f) => /^headline\d$/.test(f.prop))).toHaveLength(3);
    expect(fields.filter((f) => /^image\d$/.test(f.prop))).toHaveLength(3);
    expect(fields.find((f) => f.prop === 'swapStyle')).toMatchObject({ type: FieldType.Select, options: ['mask-up', 'mask-down', 'fade'] });
    expect(fields.find((f) => f.prop === 'columns')?.type).toBe(FieldType.Number);
    expect(fields.find((f) => f.prop === 'lineColor')?.type).toBe(FieldType.Color);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(SCROLL_STORY_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['story_headline1', 'story_image2', 'story_kicker3', 'story_swap_style', 'story_line_color']));
  });

  it('plays as a scroll story by default, in the template and in a fresh video it lands in', () => {
    const own = interactiveOf(SCROLL_STORY_TEMPLATE.template.doc);
    const landed = interactiveOf(inserted().doc);

    expect(own).toMatchObject({ playback: PlayMode.Scrub, scrollLength: STORY_SCROLL_LENGTH });
    expect(landed).toMatchObject({ playback: PlayMode.Scrub, scrollLength: STORY_SCROLL_LENGTH });
  });

  it('leaves the playback of a video that already chose one', () => {
    const chosen = { ...newMotionDoc(MotionFormat.Landscape), interactive: { ...interactiveOf({}), playback: PlayMode.InView } };
    const placed = insertTemplate(chosen, SCROLL_STORY_TEMPLATE, { from: 0, newId: () => 'x' + Math.random() });
    if (!placed.ok) {
      throw new Error(placed.error);
    }

    expect(interactiveOf(placed.doc).playback).toBe(PlayMode.InView);
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { headline2: 'zqx new\nline', swap_style: 'fade' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'headline2')?.value).toBe('zqx new\nline');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'story_swap_style')?.default).toBe('fade');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { story_headline1: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ss-grid');
  });
});
