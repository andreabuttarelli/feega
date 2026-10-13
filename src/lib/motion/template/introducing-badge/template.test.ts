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
import { BADGE_COMPONENT, BADGE_PROPS } from './component';
import { BADGE_KEY_FIELDS, BADGE_TEMPLATE_ID, INTRODUCING_BADGE_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), INTRODUCING_BADGE_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

const component = () => INTRODUCING_BADGE_TEMPLATE.template.doc.components[BADGE_COMPONENT];

describe('the introducing badge template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(BADGE_TEMPLATE_ID)).toBe(INTRODUCING_BADGE_TEMPLATE);
  });

  it('ships clean, deterministic CSS component code whose defaults pass its own schema', () => {
    expect(lintSource(component().source)).toEqual([]);
    expect(customValues(component(), {}, Strictness.Strict).ok).toBe(true);
    expect(component().source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component().source.js).not.toMatch(/webgl|THREE/i);
  });

  it('uses only sharp corners or full circles', () => {
    const radii = component().source.css.match(/border-radius:[^;]+/g) ?? [];

    radii.forEach((r) => expect(r).toMatch(/9999px|50%/));
  });

  it('exposes the texts and the logo as typed fields, at most five of them key', () => {
    const fields = INTRODUCING_BADGE_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'logo')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'features')?.type).toBe(FieldType.Text);
    expect(BADGE_KEY_FIELDS).toContain('features');
    expect(BADGE_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining(BADGE_KEY_FIELDS));
  });

  it('groups its fields into text, media, style and motion, each group in one run', () => {
    const groups = INTRODUCING_BADGE_TEMPLATE.template.doc.fields.map((f) => f.group).filter((g, i, all) => g !== all[i - 1]);

    expect(groups).toEqual(['Text', 'Media', 'Style', 'Motion']);
  });

  it('declares runtime variables for the texts, never one that would shadow the logo', () => {
    const names = interactiveOf(INTRODUCING_BADGE_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['badge_intro', 'badge_features']));
    expect(names).not.toContain('badge_logo');
  });

  it('takes the logo from the media picker and hands it to the component', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { logo: 'pic1', features: 'zqx icons\nzqx sync' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const html = composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { pic1: 'https://x.test/zqx-logo.png' } });

    expect(html).toContain('zqx-logo.png');
    expect(html).toContain('zqx icons');
    expect(html).toContain('zqx sync');
  });

  it('ships no brand of its own: no sample wordmark copied from the reference', () => {
    const defaults = JSON.stringify(Object.values(BADGE_PROPS).map((p) => p.default));

    expect(defaults).not.toMatch(/nova|rtm/i);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { badge_features: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('ib-planet');
  });
});
