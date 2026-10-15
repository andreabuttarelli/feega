import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { customValues, Strictness } from '$lib/motion/custom/component';
import { lintSource } from '$lib/motion/custom/lint';
import { builtinTemplate } from './builtins';
import { catalogue } from './catalogue';
import { templateCard } from './cards';
import { insertTemplate, instanceComp, setTemplateValues, templateFields, type TemplateEntry } from './library';
import { FieldType } from './field-model';
import { FRAMED_REVEAL_TEMPLATE } from './framed-reveal/template';
import { FR_MODEL } from './framed-reveal/model';
import { SHOWCASE_SCATTER_TEMPLATE } from './showcase-scatter/template';
import { SS_MODEL } from './showcase-scatter/model';
import { CARD_CASCADE_TEMPLATE } from './card-cascade/template';
import { CC_MODEL } from './card-cascade/model';
import { PERSPECTIVE_STACK_TEMPLATE } from './perspective-stack/template';
import { PS_MODEL } from './perspective-stack/model';
import { POSTER_DECK_FAN_TEMPLATE } from './poster-deck-fan/template';
import { PD_MODEL } from './poster-deck-fan/model';

type Frame = (p: Record<string, unknown>, t: number, length: number) => unknown;
type Case = { entry: TemplateEntry; model: string; frame: string; layout: string | null; marker: string; text: [string, string]; count: [string, number] };

const CASES: Case[] = [
  { entry: FRAMED_REVEAL_TEMPLATE, model: FR_MODEL, frame: 'revealFrame', layout: null, marker: 'fr-window', text: ['label', 'zqx caption'], count: ['count', 4] },
  { entry: SHOWCASE_SCATTER_TEMPLATE, model: SS_MODEL, frame: 'scatterFrame', layout: 'scatterLayout', marker: 'ss-cards', text: ['headline', 'zqx headline'], count: ['count', 8] },
  { entry: CARD_CASCADE_TEMPLATE, model: CC_MODEL, frame: 'cascadeFrame', layout: 'cascadeLayout', marker: 'cc-stack', text: ['words', 'zqx word'], count: ['count', 6] },
  { entry: PERSPECTIVE_STACK_TEMPLATE, model: PS_MODEL, frame: 'stackFrame', layout: 'deckLayout', marker: 'ps-deck', text: ['caption', 'zqx caption'], count: ['count', 4] },
  { entry: POSTER_DECK_FAN_TEMPLATE, model: PD_MODEL, frame: 'fanFrame', layout: 'fanLayout', marker: 'pd-deck', text: ['a_title', 'zqx title'], count: ['count', 8] }
];

const COMPONENT = (entry: TemplateEntry) => Object.values(entry.template.doc.components)[0];
const defaults = (entry: TemplateEntry) => Object.fromEntries(Object.entries(COMPONENT(entry).propsSchema.properties ?? {}).map(([k, s]) => [k, (s as { default: unknown }).default]));
const seconds = (entry: TemplateEntry) => entry.template.doc.durationInFrames / entry.template.doc.fps;

function frameOf(c: Case): Frame {
  const api = new Function(`${c.model}; return { frame: ${c.frame}, layout: ${c.layout ?? 'null'} };`)() as { frame: (...a: unknown[]) => unknown; layout: ((p: unknown) => unknown) | null };
  return (p, t, length) => (api.layout ? api.frame(api.layout(p), p, t, length) : api.frame(p, t, length));
}

function expectClose(a: unknown, b: unknown, path = ''): void {
  if (typeof a === 'number') {
    expect(b, path).toBeCloseTo(a, 5);
    return;
  }
  if (a && typeof a === 'object') {
    Object.keys(a).forEach((k) => expectClose((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`));
    return;
  }
  expect(b, path).toEqual(a);
}

const inserted = (entry: TemplateEntry, format = MotionFormat.Landscape) => {
  let n = 0;
  const placed = insertTemplate(newMotionDoc(format), entry, { from: 0, newId: () => `n${++n}` });
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  return placed;
};

describe.each(CASES)('the $entry.template.name template', (c) => {
  const { entry } = c;

  it('is a built-in video template with role chips in the catalogue', () => {
    expect(builtinTemplate(entry.id)).toBe(entry);
    expect(templateCard(entry.id)?.roles.length).toBeGreaterThan(0);
    expect(catalogue([entry])[0].mode).toBe('video');
  });

  it('ships clean, deterministic component code whose defaults pass its own schema', () => {
    const component = COMPONENT(entry);

    expect(lintSource(component.source)).toEqual([]);
    expect(customValues(component, {}, Strictness.Strict).ok).toBe(true);
    expect(component.source.js).not.toMatch(/\/\/ |\/\*/);
    expect(component.source.js).not.toMatch(/webgl|THREE/i);
  });

  it('animates with transforms and opacity only, never layout props per frame', () => {
    const draw = COMPONENT(entry).source.js.split('const draw = () => {')[1];

    expect(draw).not.toMatch(/style\.(left|top|width|height|margin|padding)\s*=/);
  });

  it('exposes media, text, colour, count and timing as fields', () => {
    const fields = entry.template.doc.fields;
    const types = new Set(fields.map((f) => f.type));

    expect(fields.find((f) => f.prop === 'media')?.type).toBe(FieldType.MediaList);
    expect([...types]).toEqual(expect.arrayContaining([FieldType.Text, FieldType.Color, FieldType.Number]));
    expect(fields.some((f) => f.group === 'Motion')).toBe(true);
    expect(entry.template.keyFields?.length).toBeLessThanOrEqual(5);
    expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining(entry.template.keyFields ?? []));
  });

  it('applies its fields: text, count and media reach the composed video', () => {
    const placed = inserted(entry);
    const set = setTemplateValues(placed.doc, placed.clipId, { media: 'pic1, video:clip1', [c.text[0]]: c.text[1], [c.count[0]]: String(c.count[1]) });
    if (!set.ok) {
      throw new Error(set.error);
    }
    const clip = instanceComp(set.doc, placed.clipId)!.comp.tracks[0].clips[0];
    const html = composeHtml({ doc: set.doc, tokens: FEEGA_TOKENS, assets: { pic1: 'https://x.test/zqx-pic.jpg', clip1: 'https://x.test/zqx-clip.mp4' } });

    expect(parseMotionDoc(set.doc).ok).toBe(true);
    expect(clip.props.count).toBe(c.count[1]);
    expect(templateFields(set.doc, placed.clipId).find((f) => f.key === c.text[0])?.value).toBe(c.text[1]);
    expect(html).toContain(c.text[1]);
    expect(html).toContain('zqx-clip.mp4');
  });

  it.each([MotionFormat.Landscape, MotionFormat.Vertical, MotionFormat.Square])('composes in %s', (format) => {
    expect(composeHtml({ doc: inserted(entry, format).doc, tokens: FEEGA_TOKENS, assets: {} })).toContain(c.marker);
  });

  it('loops: the first and the last frame match', () => {
    const frame = frameOf(c);
    const p = defaults(entry);
    const length = seconds(entry);

    expectClose(frame(p, 0, length), frame(p, length, length));
  });

  it('loops at any card count and length', () => {
    const frame = frameOf(c);
    const p = { ...defaults(entry), [c.count[0].replace(/_(\w)/g, (_, l: string) => l.toUpperCase())]: c.count[1] };

    expectClose(frame(p, 0, 9.5), frame(p, 9.5, 9.5));
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const frame = frameOf(c);
    const p = defaults(entry);
    const length = seconds(entry);
    const at = [0.4, 2.2, 5.1, 7.7, length - 0.3];
    const forward = at.map((t) => frame(p, t, length));
    const backward = [...at].reverse().map((t) => frame(p, t, length)).reverse();

    expect(backward).toEqual(forward);
  });
});

type SnakeCard = { x: number; y: number; z: number; opacity: number };

describe.each(CASES.filter((c) => c.entry === PERSPECTIVE_STACK_TEMPLATE || c.entry === POSTER_DECK_FAN_TEMPLATE))('the $entry.template.name snakes', (c) => {
  const cards = (t: number) => (frameOf(c)(defaults(c.entry), t, seconds(c.entry)) as { cards: SnakeCard[] }).cards;
  const times = Array.from({ length: seconds(c.entry) * 30 + 1 }, (_, i) => i / 30);

  it('never lets a card vanish: every card stays opaque and in front of the camera', () => {
    times.forEach((t) =>
      cards(t).forEach((card) => {
        expect(card.opacity).toBe(1);
        expect(card.z).toBeLessThan(1);
      })
    );
  });

  it('moves every card through space, not in place', () => {
    const first = cards(0);
    const frames = times.map(cards);
    const travelled = first.map((card, i) => Math.max(...frames.map((f) => Math.hypot(f[i].x - card.x, f[i].y - card.y, f[i].z - card.z))));

    travelled.forEach((d) => expect(d).toBeGreaterThan(0.2));
  });

  it('keeps each card close behind the one it follows', () => {
    const per = Number(defaults(c.entry).count);
    times.forEach((t) => {
      const all = cards(t);
      all.forEach((card, i) => {
        if (i % per === 0) {
          return;
        }
        expect(Math.hypot(card.x - all[i - 1].x, card.y - all[i - 1].y, card.z - all[i - 1].z)).toBeLessThan(0.4);
      });
    });
  });
});
