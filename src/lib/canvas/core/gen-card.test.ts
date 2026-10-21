import { describe, expect, it } from 'vitest';
import type { PathItem } from '$lib/motion/gpu-full/display-list';
import { rgbaOf } from '$lib/motion/gpu-full/rgba';
import { mix } from '$lib/canvas/gpu/theme';
import type { GenTileView } from '$lib/canvas/gen-tile-view';
import type { Glyphs } from './chrome';
import type { CoreTheme } from './overlay';
import { GenPart, genItems, genMark, type GenIcons } from './gen-card';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', paper2: '#f9f9f9', line: '#ededef', line2: '#d2d2d7', ink: '#1d1d1f', inkSoft: '#6e6e73', chip: '#f2f2f2', chipInk: '#141414', accent: '#0099ff', wire: '#b3b3b6', iterate: '#d97706' };
const glyphs: Glyphs = (text, size) => ({ contours: text ? [[0, 0, text.length * size * 0.5, 0, text.length * size * 0.5, size, 0, size]] : [], width: text.length * size * 0.5, height: size });
const icons: GenIcons = { references: [[0, 0, 14, 0, 14, 14, 0, 14]], credit: [[0, 0, 12, 0, 12, 12, 0, 12]], chevron: [[0, 0, 12, 0, 12, 12, 0, 12]], voicePlay: [[0, 0, 12, 0, 12, 12, 0, 12]] };

const view = (over: Partial<GenTileView> = {}): GenTileView => ({
  medium: 'image',
  state: 'empty',
  hasBody: true,
  hint: 'Write what you want',
  placeholder: 'Describe what you want to see…',
  prompt: '',
  output: null,
  error: null,
  warn: { text: 'Write what you want', soft: true },
  run: { label: 'Generate', credits: '~0.04', variable: false, enabled: false },
  loop: null,
  runs: 0,
  shown: -1,
  form: [],
  ...over
});

const card = { id: 'n', x: 0, y: 0, w: 360, h: 460 };
const draw = (v: GenTileView, c = card) => genItems(c, v, { theme, glyphs, bold: glyphs, icons });
const parts = (items: PathItem[], p: GenPart) => items.filter((i) => i.clip === `n:${p}` || i.clip.startsWith(`n:${p}:`));
const bounds = (i: PathItem) => {
  const xs = i.contours.flatMap((c) => c.filter((_, k) => k % 2 === 0));
  const ys = i.contours.flatMap((c) => c.filter((_, k) => k % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10);
};

describe('genItems', () => {
  it('lays out an image node like the DOM tile: body, references band, footer', () => {
    const items = draw(view());

    expect(bounds(parts(items, GenPart.Body)[0])).toEqual([1, 1, 359, 304.5]);
    expect(bounds(parts(items, GenPart.References)[0])).toEqual([1, 304.5, 359, 305.5]);
    expect(bounds(parts(items, GenPart.Prompt)[0])).toEqual([10, 358.5, 350, 408.7]);
    expect(parts(items, GenPart.Hint)).toHaveLength(1);
  });

  it('fades a disabled run button and keeps it right aligned', () => {
    const [button] = parts(draw(view()), GenPart.Run);

    expect(button.opacity).toBe(1);
    expect(bounds(button)[2]).toBe(350);
    expect(button.paint).toEqual({ kind: 'solid', color: rgbaOf(mix(theme.ink, theme.paper, 0.35)) });
  });

  it('writes the prompt instead of the placeholder once there is one', () => {
    const items = draw(view({ prompt: 'Orange sun on blue' }));
    const text = parts(items, GenPart.PromptText);

    expect(text).toHaveLength(1);
    expect(text[0].paint).toEqual({ kind: 'solid', color: rgbaOf(theme.ink) });
  });

  it('gives a bodiless text node the whole card for its prompt', () => {
    const items = draw(view({ medium: 'text', hasBody: false }), { ...card, h: 220 });

    expect(parts(items, GenPart.Body)).toHaveLength(0);
    expect(parts(items, GenPart.References)).toHaveLength(0);
    expect(bounds(parts(items, GenPart.Prompt)[0])[1]).toBe(10);
  });

  it('shows dots and an unlock button while running, a reason and retry when failed', () => {
    expect(parts(draw(view({ state: 'running' })), GenPart.Dots)).toHaveLength(3);
    expect(parts(draw(view({ state: 'running' })), GenPart.Unlock).length).toBeGreaterThan(0);
    expect(parts(draw(view({ state: 'failed', error: 'boom' })), GenPart.FailWhy)).toHaveLength(1);
  });

  it('draws the loop button and the warning when the tile has them', () => {
    const items = draw(view({ loop: { label: 'Loop ×2', credits: '~0.08', variable: false, enabled: false, cancel: false } }));

    expect(parts(items, GenPart.Loop).length).toBeGreaterThan(0);
    expect(parts(items, GenPart.Warn)).toHaveLength(1);
  });

  it('marks a finished output as AI-generated, and nothing before', () => {
    expect(genMark(card, view({ state: 'done' }), { theme, glyphs, bold: glyphs, icons })).toHaveLength(2);
    expect(genMark(card, view(), { theme, glyphs, bold: glyphs, icons })).toHaveLength(0);
  });

  it('draws the markdown toggle over a finished text output', () => {
    expect(parts(draw(view({ medium: 'text', state: 'done', output: 'hi' }), { ...card, h: 220 }), GenPart.Toggle).length).toBeGreaterThan(0);
  });

  it('replaces the references band of an audio tile with its controls', () => {
    const form = [
      { kind: 'select' as const, label: 'Operation', value: 'Text to speech', ratio: 0 },
      { kind: 'slider' as const, label: 'Stability', value: '', ratio: 0.5 }
    ];
    const items = draw(view({ medium: 'audio', form }), { id: 'n', x: 0, y: 0, w: 320, h: 400 });

    expect(items.some((i) => i.clip.startsWith(`n:${GenPart.Form}`))).toBe(true);
    expect(items.some((i) => i.clip.startsWith(`n:${GenPart.References}`))).toBe(false);
  });
});
