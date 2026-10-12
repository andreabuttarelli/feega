import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, setTemplateValues } from '../library';
import { FieldType } from '../field-model';
import { TVS_COMPONENT } from './component';
import { TVS_KEY_FIELDS, TVS_TEMPLATE_ID, VINTAGE_TVS_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), VINTAGE_TVS_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the vintage tvs template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(TVS_TEMPLATE_ID)).toBe(VINTAGE_TVS_TEMPLATE);
  });

  it('ships clean, deterministic component code, CSS only whose defaults pass its own schema', () => {
    const component = VINTAGE_TVS_TEMPLATE.template.doc.components[TVS_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js).not.toMatch(/webgl|THREE/i);
  });

  it('exposes at most five key fields, all of them real', () => {
    const keys = VINTAGE_TVS_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(TVS_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(keys).toEqual(expect.arrayContaining(TVS_KEY_FIELDS));
    expect(VINTAGE_TVS_TEMPLATE.template.doc.fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
  });

  it('groups its fields, text and media first', () => {
    const groups = [...new Set(VINTAGE_TVS_TEMPLATE.template.doc.fields.map((f) => f.group))];

    expect(groups.slice(0, 2)).toEqual(['Text', 'Media']);
    expect(groups).toEqual(expect.arrayContaining(['TVs', 'Screen', 'Motion']));
  });

  it('declares runtime variables, never one for the media', () => {
    const names = interactiveOf(VINTAGE_TVS_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['tvs_title', 'tvs_count', 'tvs_scanlines']));
    expect(names).not.toContain('tvs_media');
  });

  it('hands picked pictures and videos to the component', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { media: 'pic1, video:clip1' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const html = composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { pic1: 'https://x.test/zqx-pic.jpg', clip1: 'https://x.test/zqx-clip.mp4' } });

    expect(html).toContain('zqx-clip.mp4');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { tvs_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('vt-wall');
  });
});
