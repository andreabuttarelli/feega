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
import { PATH_COMPONENT } from './component';
import { PATH_KEY_FIELDS, PATH_TEMPLATE_ID, PATH_CARDS_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), PATH_CARDS_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the path cards template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(PATH_TEMPLATE_ID)).toBe(PATH_CARDS_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = PATH_CARDS_TEMPLATE.template.doc.components[PATH_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js, 'CSS only, no WebGL context').not.toMatch(/webgl|THREE/i);
  });

  it('exposes the places, media, reviews and path colour as typed fields', () => {
    const fields = PATH_CARDS_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'places')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'accent')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'moveSeconds')?.type).toBe(FieldType.Number);
  });

  it('names its key fields among the fields it exposes', () => {
    const keys = PATH_CARDS_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(keys).toEqual(expect.arrayContaining(PATH_KEY_FIELDS));
    expect(PATH_CARDS_TEMPLATE.template.keyFields).toEqual(PATH_KEY_FIELDS);
  });

  it('groups its fields into text, media, style, cards, path and motion', () => {
    const groups = [...new Set(PATH_CARDS_TEMPLATE.template.doc.fields.map((f) => f.group))];

    expect(groups).toEqual(['Text', 'Media', 'Cards', 'Style', 'Path', 'Motion']);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(PATH_CARDS_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['path_places', 'path_reviews', 'path_accent', 'path_background']));
    expect(names, 'a text variable would shadow the picked media at runtime').not.toContain('path_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { places: 'zqx one|zqx two', hold_seconds: '2' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'places')?.value).toBe('zqx one|zqx two');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'path_hold_seconds')?.default).toBe(2);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { path_places: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('pc-world');
  });

  it('paints the path and its dot under the cards', () => {
    const js = PATH_CARDS_TEMPLATE.template.doc.components[PATH_COMPONENT].source.js;
    const order = ['pc-path', 'pc-dot', 'pc-cards'].map((cls) => js.indexOf(`class="${cls}"`));

    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
