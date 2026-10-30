import { describe, expect, it } from 'vitest';
import { ColourPaint, tokensOf, type Samples, type TextUse } from './page-tokens';

const colour = (hex: string, paint: ColourPaint, weight = 1, button = false) => ({ hex, paint, weight, button });

const text = (over: Partial<TextUse>): TextUse => ({ font: 'Inter', weight: 400, sizePx: 16, leading: 1.5, tracking: 0, textCase: 'as-typed', chars: 40, heading: 0, button: false, ...over });

const EMPTY: Samples = { colours: [], texts: [], effects: [], gradients: [], radii: [], spacing: [], ctas: [] };

const PAGE: Samples = {
  ...EMPTY,
  colours: [
    colour('#ffffff', ColourPaint.Fill, 1_000_000),
    colour('#f6f9fc', ColourPaint.Fill, 200_000),
    colour('#f6f9fd', ColourPaint.Fill, 1_000),
    colour('#061b31', ColourPaint.Text, 4_000),
    colour('#50617a', ColourPaint.Text, 900),
    colour('#533afd', ColourPaint.Fill, 30, true),
    colour('#533afd', ColourPaint.Fill, 30, true),
    colour('#e5edf5', ColourPaint.Border, 12),
    colour('#ff6118', ColourPaint.Fill, 50),
    colour('#ff6118', ColourPaint.Fill, 50)
  ]
};

const names = (s: Samples) => Object.fromEntries(tokensOf(s).colours.map((c) => [c.name, c.hex]));

describe('page tokens', () => {
  it('names the colours of a page by the role they play', () => {
    expect(names(PAGE)).toEqual({ Background: '#ffffff', Surface: '#f6f9fc', Text: '#061b31', 'Text muted': '#50617a', Primary: '#533afd', Border: '#e5edf5', Accent: '#ff6118' });
  });

  it('a very dark tint is named Navy or Ink, a very light one Tint, never by its hue', () => {
    const twice = (hex: string) => [colour(hex, ColourPaint.Fill, 20), colour(hex, ColourPaint.Fill, 20)];
    const found = names({ ...PAGE, colours: [...PAGE.colours, ...twice('#0a2540'), ...twice('#1f0a40'), ...twice('#bcd2ff')] });

    expect(found).toMatchObject({ Navy: '#0a2540', Ink: '#1f0a40', Tint: '#bcd2ff' });
    expect(Object.keys(found)).not.toContain('Blue');
    expect(Object.keys(found)).not.toContain('Purple');
  });

  it('merges near-duplicate colours into one token that keeps every member', () => {
    const surface = tokensOf(PAGE).colours.find((c) => c.name === 'Surface')!;

    expect(surface.members).toEqual(['#f6f9fc', '#f6f9fd']);
  });

  it('a brand colour of the same site wins over the page value it is close to', () => {
    const primary = tokensOf(PAGE, { palette: ['#533AFE'] }).colours.find((c) => c.name === 'Primary')!;

    expect(primary.hex).toBe('#533afe');
    expect(primary.members).toContain('#533afd');
  });

  it('Primary is the colour that fills things, over one only used for text', () => {
    const purple = [colour('#533afd', ColourPaint.Fill, 30), colour('#533afd', ColourPaint.Fill, 30)];
    const orange = Array.from({ length: 6 }, () => colour('#ff6118', ColourPaint.Text, 5, true));

    expect(names({ ...EMPTY, colours: [colour('#ffffff', ColourPaint.Fill, 1e6), colour('#111111', ColourPaint.Text, 1e4), ...orange, ...purple] }).Primary).toBe('#533afd');
  });

  it('Primary is the fill of the main buttons, not the most used colour', () => {
    const yellow = Array.from({ length: 8 }, () => colour('#f2c94c', ColourPaint.Fill, 400));
    const indigo = [colour('#5e6ad2', ColourPaint.Fill, 60), colour('#5e6ad2', ColourPaint.Fill, 60)];

    expect(names({ ...EMPTY, colours: [colour('#08090a', ColourPaint.Fill, 1e6), colour('#f7f8f8', ColourPaint.Text, 1e4), ...yellow, ...indigo], ctas: [{ hex: '#5e6ad2', area: 6000 }] }).Primary).toBe('#5e6ad2');
  });

  it('a monochrome site gets the button that stands out from the page as Primary, and keeps it as Text too', () => {
    const blue = [colour('#0070f3', ColourPaint.Fill, 30), colour('#0070f3', ColourPaint.Fill, 30)];
    const buttons = [colour('#171717', ColourPaint.Fill, 60), colour('#171717', ColourPaint.Fill, 60)];
    const ctas = [{ hex: '#ffffff', area: 10_000 }, { hex: '#171717', area: 7_000 }];
    const found = names({ ...EMPTY, colours: [colour('#ffffff', ColourPaint.Fill, 1e6), colour('#171717', ColourPaint.Text, 1e4), colour('#4d4d4d', ColourPaint.Text, 900), ...blue, ...buttons], ctas });

    expect([found.Primary, found.Text]).toEqual(['#171717', '#171717']);
  });

  it('with no coloured button, the brand colour found on the page is Primary', () => {
    const yellow = Array.from({ length: 8 }, () => colour('#f0bf00', ColourPaint.Fill, 400));
    const indigo = [colour('#5e6ad2', ColourPaint.Fill, 20), colour('#5e6ad2', ColourPaint.Fill, 20)];
    const page = { ...EMPTY, colours: [colour('#08090a', ColourPaint.Fill, 1e6), colour('#f7f8f8', ColourPaint.Text, 1e4), colour('#e5e5e6', ColourPaint.Fill, 30), colour('#e5e5e6', ColourPaint.Fill, 30), ...yellow, ...indigo], ctas: [{ hex: '#e5e5e6', area: 2_000 }] };

    expect(Object.fromEntries(tokensOf(page, { palette: ['#5E6AD2', '#08090A'] }).colours.map((c) => [c.name, c.hex])).Primary).toBe('#5e6ad2');
  });

  it('a colour used once and with no role is not a token', () => {
    const once = tokensOf({ ...PAGE, colours: [...PAGE.colours, colour('#123456', ColourPaint.Fill, 1)] });

    expect(once.colours.map((c) => c.hex)).not.toContain('#123456');
  });

  it('keeps text styles used twice or by a heading, and names them by size and role', () => {
    const body = text({ chars: 4_000 });
    const tokens = tokensOf({
      ...EMPTY,
      texts: [body, body, text({ sizePx: 64, weight: 600, heading: 1 }), text({ sizePx: 40, heading: 2 }), text({ sizePx: 40, heading: 2 }), text({ sizePx: 24, heading: 3 }), text({ sizePx: 14, weight: 500, button: true }), text({ sizePx: 14, weight: 500, button: true }), text({ sizePx: 14 }), text({ sizePx: 14 }), text({ sizePx: 12 }), text({ sizePx: 12 }), text({ sizePx: 11 })]
    });

    expect(tokens.texts.map((t) => [t.name, t.style.sizePx])).toEqual([
      ['Body', 16],
      ['Button', 14],
      ['H1', 64],
      ['H2', 40],
      ['H3', 24],
      ['Small', 14],
      ['Caption', 12]
    ]);
  });

  it('the h1 is H1 even when its style is shared with other headings and text', () => {
    const big = { sizePx: 56, weight: 500 };
    const tokens = tokensOf({ ...EMPTY, texts: [text({ chars: 4_000 }), text({ chars: 4_000 }), text({ ...big, heading: 2 }), text({ ...big, heading: 1 }), text(big), text({ sizePx: 32, heading: 2 })] });

    expect(tokens.texts.find((t) => t.name === 'H1')?.style.sizePx).toBe(56);
  });

  it('colours past the named roles are named by hue or by what they paint, never by number', () => {
    const twice = (hex: string, paint: ColourPaint, weight = 10) => [colour(hex, paint, weight), colour(hex, paint, weight)];
    const tokens = tokensOf({ ...PAGE, colours: [...PAGE.colours, ...twice('#22c55e', ColourPaint.Fill), ...twice('#3b82f6', ColourPaint.Fill), ...twice('#eeeeee', ColourPaint.Fill, 500), ...twice('#999999', ColourPaint.Text)] });

    expect(tokens.colours.map((c) => c.name).filter((n) => !Object.keys(names(PAGE)).includes(n)).sort()).toEqual(['Blue', 'Green', 'Surface 2', 'Text 2']);
  });

  it('text styles past the named roles are named by heading level, case or size, never by number', () => {
    const body = text({ chars: 4_000 });
    const tokens = tokensOf({ ...EMPTY, texts: [body, body, text({ sizePx: 48, heading: 1 }), text({ sizePx: 32, heading: 2 }), text({ sizePx: 24, heading: 3 }), text({ sizePx: 20, heading: 4 }), text({ sizePx: 14 }), text({ sizePx: 14 }), text({ sizePx: 12 }), text({ sizePx: 12 }), text({ sizePx: 13, textCase: 'upper' }), text({ sizePx: 13, textCase: 'upper' }), text({ sizePx: 18 }), text({ sizePx: 18 })] });

    expect(tokens.texts.map((t) => t.name).some((n) => /^Text \d/.test(n))).toBe(false);
    expect(tokens.texts.map((t) => t.name)).toEqual(expect.arrayContaining(['H4', 'Label', 'Body large']));
  });

  it('shadows, radii and spacing become a named scale', () => {
    const shadow = (blur: number) => ({ key: `s${blur}`, blur, shadow: true });
    const tokens = tokensOf({ ...EMPTY, effects: [shadow(4), shadow(4), shadow(24), shadow(24)], radii: [4, 4, 8, 8, 9999, 9999, 3], spacing: [8, 8, 16, 16, 24, 24, 5] });

    expect(tokens.effects.map((e) => [e.name, e.key])).toEqual([
      ['Shadow small', 's4'],
      ['Shadow medium', 's24']
    ]);
    expect(tokens.radii.map((r) => [r.name, r.value])).toEqual([
      ['Radius S', 4],
      ['Radius M', 8],
      ['Radius full', 9999]
    ]);
    expect(tokens.spacing.map((r) => [r.name, r.value])).toEqual([
      ['Space 1', 8],
      ['Space 2', 16],
      ['Space 3', 24]
    ]);
  });
});
