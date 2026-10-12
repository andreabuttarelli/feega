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
import { COMMENTS_COMPONENT, COMMENTS_PROPS } from './component';
import { COMMENT_GRID_TEMPLATE, COMMENTS_KEY_FIELDS, COMMENTS_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), COMMENT_GRID_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the comment grid template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(COMMENTS_TEMPLATE_ID)).toBe(COMMENT_GRID_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = COMMENT_GRID_TEMPLATE.template.doc.components[COMMENTS_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js, 'crisp CSS cards, no WebGL context').not.toMatch(/webgl|THREE/i);
  });

  it('ships 16 to 20 fictional comments, each with a name, a handle and a rating', () => {
    const lines = String(COMMENTS_PROPS.comments.default).split('\n');

    expect(lines.length).toBeGreaterThanOrEqual(16);
    expect(lines.length).toBeLessThanOrEqual(20);
    lines.forEach((l) => expect(l.split('|')).toHaveLength(4));
  });

  it('exposes the comments, the avatars, the theme and the title as typed fields', () => {
    const fields = COMMENT_GRID_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'avatars')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'comments')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'theme')?.type).toBe(FieldType.Select);
    expect(fields.find((f) => f.prop === 'title')?.type).toBe(FieldType.Text);
  });

  it('names at most five key fields among the fields it exposes', () => {
    const keys = COMMENT_GRID_TEMPLATE.template.doc.fields.map((f) => f.key);

    expect(COMMENTS_KEY_FIELDS.length).toBeLessThanOrEqual(5);
    expect(keys).toEqual(expect.arrayContaining(COMMENTS_KEY_FIELDS));
    expect(COMMENT_GRID_TEMPLATE.template.keyFields).toEqual(COMMENTS_KEY_FIELDS);
  });

  it('groups its fields into text, media, style, cards, focus and motion, each group in one run', () => {
    const groups = COMMENT_GRID_TEMPLATE.template.doc.fields.map((f) => f.group).filter((g, i, all) => g !== all[i - 1]);

    expect(groups).toEqual(['Text', 'Media', 'Style', 'Cards', 'Focus', 'Motion']);
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(COMMENT_GRID_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['comments_title', 'comments_theme', 'comments_speed']));
    expect(names, 'a text variable would shadow the picked avatars at runtime').not.toContain('comments_avatars');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx said so', theme: 'dark' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx said so');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'comments_theme')?.default).toBe('dark');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { comments_title: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('cg-grid');
  });
});
