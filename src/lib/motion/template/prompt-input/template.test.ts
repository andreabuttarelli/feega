import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, instanceComp, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { PROMPT_COMPONENT, PROMPT_PROPS } from './component';
import { PROMPT_INPUT_TEMPLATE, PROMPT_TEMPLATE_ID } from './template';

const ids = () => {
  let n = 0;
  return () => `n${++n}`;
};

const inserted = (doc: MotionDoc = newMotionDoc(MotionFormat.Vertical), newId = ids()) => {
  const placed = insertTemplate(doc, PROMPT_INPUT_TEMPLATE, { from: 0, newId });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

const promptClip = (doc: MotionDoc, clipId: string) => instanceComp(doc, clipId)!.comp.tracks[0].clips[0];

describe('the prompt input template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(PROMPT_TEMPLATE_ID)).toBe(PROMPT_INPUT_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = PROMPT_INPUT_TEMPLATE.template.doc.components[PROMPT_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/|\/\*/);
  });

  it('exposes every setting as a typed field', () => {
    const fields = PROMPT_INPUT_TEMPLATE.template.doc.fields;
    const props = fields.map((f) => f.prop);

    expect(props).toEqual(expect.arrayContaining(Object.keys(PROMPT_PROPS).filter((k) => k !== 'varPrefix')));
    expect(fields.find((f) => f.prop === 'accent')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'speed')).toMatchObject({ type: FieldType.Number, min: 4, max: 40 });
    expect(fields.find((f) => f.prop === 'theme')).toMatchObject({ type: FieldType.Select, options: ['light', 'dark'] });
    expect(fields.find((f) => f.prop === 'typo')?.type).toBe(FieldType.Boolean);
  });

  it('groups its fields into text, style and motion, in that order', () => {
    const groups = [...new Set(PROMPT_INPUT_TEMPLATE.template.doc.fields.map((f) => f.group))];

    expect(groups).toEqual(['Text', 'Style', 'Motion']);
    expect(PROMPT_INPUT_TEMPLATE.template.doc.fields.find((f) => f.prop === 'cameraZoom')?.group).toBe('Motion');
  });

  it('declares runtime variables an embedding site can set', () => {
    const names = interactiveOf(PROMPT_INPUT_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['prompt_text', 'prompt_accent', 'prompt_theme', 'prompt_speed']));
  });

  it('inserting copies an editable instance: its code, its fields and its variables land in the project', () => {
    const placed = inserted();
    const doc = placed.doc;

    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(doc.components[PROMPT_COMPONENT].source.js).toContain('promptFrame');
    expect(templateFields(doc, placed.clipId).map((f) => f.key)).toEqual(expect.arrayContaining(['text', 'accent', 'font_size']));
    expect(interactiveOf(doc).vars.map((v) => v.name)).toContain('prompt_text');
    expect(promptClip(doc, placed.clipId).props.varPrefix).toBe('prompt');
  });

  it('a second instance gets its own variables, so one host value does not drive both', () => {
    const first = inserted();
    const second = inserted(first.doc, (() => {
      let n = 100;
      return () => `m${++n}`;
    })());
    const names = interactiveOf(second.doc).vars.map((v) => v.name);

    expect(promptClip(second.doc, second.clipId).props.varPrefix).toBe('prompt2');
    expect(names).toEqual(expect.arrayContaining(['prompt_text', 'prompt2_text']));
  });

  it('setting a field also moves the variable that drives it, so the two never disagree', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { text: 'Zqx write a haiku', accent: '#ff5a1f' });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const vars = interactiveOf(set.doc).vars;

    expect(promptClip(set.doc, placed.clipId).props.text).toBe('Zqx write a haiku');
    expect(vars.find((v) => v.name === 'prompt_text')?.default).toBe('Zqx write a haiku');
    expect(vars.find((v) => v.name === 'prompt_accent')?.default).toBe('#ff5a1f');
  });

  it('refuses a value outside its field', () => {
    const placed = inserted();

    expect(setTemplateValues(placed.doc, placed.clipId, { speed: '400' })).toMatchObject({ ok: false });
    expect(setTemplateValues(placed.doc, placed.clipId, { theme: 'sepia' })).toMatchObject({ ok: false });
  });

  it("loads the chosen font across its weights, so any text weight renders true", () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { font: 'Geist', font_weight: '600' });
    const html = set.ok ? composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: {} }) : '';

    expect(html).toContain("family=Geist:wght@100..900");
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const placed = inserted(newMotionDoc(format));
    const html = composeHtml({ doc: placed.doc, tokens: FEEGA_TOKENS, assets: {}, vars: { prompt_text: 'Zqx from the host' } });

    expect(html).toContain('Zqx from the host');
    expect(html).toContain('pi-box');
  });
});
