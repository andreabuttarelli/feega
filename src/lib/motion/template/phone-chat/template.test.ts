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
import { CHAT_COMPONENT } from './component';
import { CHAT_TEMPLATE_ID, PHONE_CHAT_TEMPLATE } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), PHONE_CHAT_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe('the phone chat template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(CHAT_TEMPLATE_ID)).toBe(PHONE_CHAT_TEMPLATE);
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = PHONE_CHAT_TEMPLATE.template.doc.components[CHAT_COMPONENT];

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('exposes the messages, the avatars and the look as typed fields', () => {
    const fields = PHONE_CHAT_TEMPLATE.template.doc.fields;

    expect(fields.find((f) => f.prop === 'messages')?.type).toBe(FieldType.Text);
    expect(fields.find((f) => f.prop === 'avatars')?.type).toBe(FieldType.MediaList);
    expect(fields.find((f) => f.prop === 'finish')?.type).toBe(FieldType.Select);
    expect(fields.find((f) => f.prop === 'bubble')?.type).toBe(FieldType.Color);
    expect(fields.find((f) => f.prop === 'leave')?.type).toBe(FieldType.Boolean);
  });

  it('names at most five key fields among the fields it exposes', () => {
    const keys = PHONE_CHAT_TEMPLATE.template.doc.fields.map((f) => f.key);
    const picked = PHONE_CHAT_TEMPLATE.template.keyFields ?? ['missing'];

    expect(picked.length).toBeLessThanOrEqual(5);
    expect(keys).toEqual(expect.arrayContaining(picked));
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { title: 'zqx crew', push: '0.12' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'title')?.value).toBe('zqx crew');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'chat_push')?.default).toBe(0.12);
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { chat_messages: 'Zed | zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('pc-phone');
  });

  it('carries no brand name or logo of a real phone or chat maker', () => {
    const code = JSON.stringify(PHONE_CHAT_TEMPLATE.template.doc);

    expect(code).not.toMatch(/iphone|apple|samsung|galaxy|pixel|imessage|whatsapp|telegram/i);
  });

  it('groups the device controls together in the properties', () => {
    const fields = PHONE_CHAT_TEMPLATE.template.doc.fields;

    ['finish', 'phoneSize', 'phoneTop', 'shadow', 'clock'].forEach((prop) => expect(fields.find((f) => f.prop === prop)?.group).toBe('Device'));
  });
});
