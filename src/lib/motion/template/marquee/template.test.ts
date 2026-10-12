import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml, Target } from '$lib/motion/hyperframes/compose';
import { ComponentMode, customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { interactiveOf } from '$lib/motion/interactive/settings';
import { builtinTemplate } from '../builtins';
import { insertTemplate, setTemplateValues, templateFields } from '../library';
import { FieldType } from '../field-model';
import { MARQUEE_COMPONENT, MARQUEE_PROPS } from './component';
import { MARQUEE_MODEL } from './model';
import { defaultsOf } from '../custom-template';
import { MARQUEE_TEMPLATE, MARQUEE_TEMPLATE_ID } from './template';

const inserted = (format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), MARQUEE_TEMPLATE, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

const field = (prop: string) => MARQUEE_TEMPLATE.template.doc.fields.find((f) => f.prop === prop);

describe('the marquee template', () => {
  it('is a built-in template', () => {
    expect(builtinTemplate(MARQUEE_TEMPLATE_ID)).toBe(MARQUEE_TEMPLATE);
  });

  it('is live, so embeds forward the pointer, and its code is clean for that mode', () => {
    const component = MARQUEE_TEMPLATE.template.doc.components[MARQUEE_COMPONENT];

    expect(component.mode).toBe(ComponentMode.Live);
    expect(lintSource(component.source, ComponentMode.Live)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
  });

  it('draws the video from t, not from a frozen still', () => {
    const js = MARQUEE_TEMPLATE.template.doc.components[MARQUEE_COMPONENT].source.js;

    expect(js).toMatch(/return \{\s*still/);
  });

  it('exposes items, direction, speed and interaction as typed fields', () => {
    expect(field('media')?.type).toBe(FieldType.MediaList);
    expect(field('quotes')?.type).toBe(FieldType.Text);
    expect(field('direction')).toMatchObject({ type: FieldType.Select, options: ['left', 'right', 'up', 'down'] });
    expect(field('speed')?.type).toBe(FieldType.Number);
    expect(field('drag')?.type).toBe(FieldType.Boolean);
    expect(field('pauseOnHover')?.type).toBe(FieldType.Boolean);
    expect(field('background')?.type).toBe(FieldType.Color);
  });

  it('puts items, direction, speed and background on top', () => {
    expect(MARQUEE_TEMPLATE.template.keyFields).toEqual(['media', 'quotes', 'direction', 'speed', 'background']);
  });

  it('declares runtime variables an embedding site can set, never one shadowing the picked media', () => {
    const names = interactiveOf(MARQUEE_TEMPLATE.template.doc).vars.map((v) => v.name);

    expect(names).toEqual(expect.arrayContaining(['marquee_quotes', 'marquee_direction', 'marquee_speed', 'marquee_drag', 'marquee_pause_on_hover']));
    expect(names).not.toContain('marquee_media');
  });

  it('setting a field moves its variable too', () => {
    const placed = inserted();
    const set = setTemplateValues(placed.doc, placed.clipId, { quotes: 'zqx works — Ada', direction: 'up' });
    if (!set.ok) {
      throw new Error(set.error);
    }

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === 'quotes')?.value).toBe('zqx works — Ada');
    expect(interactiveOf(set.doc).vars.find((v) => v.name === 'marquee_direction')?.default).toBe('up');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s with the variables reaching the component', (format) => {
    const html = composeHtml({ doc: inserted(format).doc, tokens: FEEGA_TOKENS, assets: {}, vars: { marquee_quotes: 'zqx from the host' } });

    expect(html).toContain('zqx from the host');
    expect(html).toContain('mq-row');
  });

  it('plays live on screen and from t in the video', () => {
    const doc = inserted().doc;

    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, target: Target.Screen })).toContain('"play":"live"');
    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, target: Target.Video })).toContain('"play":"still"');
  });

  it('shows the speed it really runs at: the default lands on whole wraps, calm, with a dozen names or more', () => {
    const p = defaultsOf(MARQUEE_PROPS) as Record<string, string | number>;
    const plan = new Function(`${MARQUEE_MODEL}; return rowPlan;`)() as (p: object, row: number, count: number, length: number) => { cruise: number };
    const seconds = MARQUEE_TEMPLATE.template.doc.durationInFrames / MARQUEE_TEMPLATE.template.doc.fps;
    const counts = [String(p.wordmarks).split(',').length, String(p.quotes).split('\n').length];

    expect(counts[0]).toBeGreaterThanOrEqual(12);
    counts.forEach((count, row) => {
      expect(Math.abs(Math.abs(plan(p, row, count, seconds).cruise) - Number(p.speed)) / Number(p.speed), `row ${row}`).toBeLessThan(0.1);
    });
    expect(Number(p.speed)).toBeLessThanOrEqual(0.2);
  });
});
