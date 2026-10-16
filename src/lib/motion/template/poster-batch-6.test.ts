// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { PropFormat, customValues, Strictness } from '$lib/motion/custom/component';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { partUsage } from '$lib/motion/part-usage';
import { PartEdit, editablePart, parsePart } from '$lib/motion/poster-parts';
import type { MotionClip } from '$lib/motion/doc';
import { POSTER_BATCH_6 } from './poster-batch-6';

const TEXT: (string | undefined)[] = [undefined, PropFormat.Textarea];
const timeline = { to: () => timeline };

function drawn(js: string, props: Record<string, unknown>): HTMLElement {
  const root = document.createElement('div');
  new Function('root', 'props', 'tl', 'duration', 'assets', js)(root, props, timeline, 2, {});
  return root;
}

describe.each(POSTER_BATCH_6)('the %s poster', (_id, entry, name) => {
  const doc = entry.template.doc;
  const clip = doc.tracks.flatMap((t) => t.clips as MotionClip[])[0];
  const component = doc.components[name];
  const schema = component.propsSchema.properties;
  const values = customValues(component, {}, Strictness.Strict);
  const root = drawn(component.source.js, values.ok ? values.values : {});
  const parts = [...root.querySelectorAll('[data-part]')].map((el) => el.getAttribute('data-part')!);
  const fields = [...new Set(parts.map((p) => parsePart(p).field))];
  const shape = (field: string) => !(field in schema) && `${field}Color` in schema;
  const content = fields.filter((f) => !shape(f));

  it('composes into a page', () => {
    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' })).toContain(name);
  });

  it('draws parts, each one a field of its own', () => {
    expect(parts.length).toBeGreaterThan(4);
    expect(content.filter((f) => !(f in schema))).toEqual([]);
  });

  it('keeps each font inside its style attribute', () => {
    expect(root.innerHTML).not.toContain('system-ui,=""');
  });

  it('lets every text part be edited in place', () => {
    const text = parts.filter((p) => content.includes(parsePart(p).field) && schema[parsePart(p).field].type === 'string' && TEXT.includes(schema[parsePart(p).field].format));
    expect(text.filter((p) => editablePart(doc, clip, p) !== PartEdit.Text)).toEqual([]);
  });

  it('gives every part a colour that reaches it, or a photo fill', () => {
    const usage = partUsage(name)!;
    const colourless = fields.filter((field) => {
      const reaching = Object.keys(schema).filter((k) => schema[k]?.format === PropFormat.Color && usage.fields[k]?.includes(field));
      return schema[field]?.format !== PropFormat.Media && !reaching.length && !(`${field}Color` in schema);
    });
    expect(colourless).toEqual([]);
  });
});
