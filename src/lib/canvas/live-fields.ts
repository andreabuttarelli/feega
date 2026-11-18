export enum LiveProp {
  Text = 'text',
  Color = 'color',
  Fill = 'fill',
  FontSize = 'fontSize',
  FontWeight = 'fontWeight',
  Padding = 'padding',
  Margin = 'margin',
  Gap = 'gap',
  Radius = 'radius',
  Class = 'class'
}

export enum Side {
  All = '',
  X = 'x',
  Y = 'y',
  Top = 't',
  Right = 'r',
  Bottom = 'b',
  Left = 'l'
}

export enum LiveAsk {
  Hover = 'hover',
  Pick = 'pick',
  Refresh = 'refresh'
}

const TEXT_SIZE = /^text-(xs|sm|base|lg|[2-9]?xl|\[[\d.]+(px|rem|em)\])$/;
const TEXT_NOT_COLOUR = /^text-(left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/;
const BG_NOT_COLOUR = /^bg-(\[url|gradient|linear|radial|conic|none|clip|fixed|local|scroll|cover|contain|auto|center|top|bottom|left|right|no-repeat|repeat|origin|blend)/;
const WEIGHT = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/;
const RADIUS_SIDE = /^rounded-(t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee)(-|$)/;

export type ClassRule = { make: (value: string, side: Side) => string; owns: (token: string, side: Side) => boolean };

const spacing = (letter: string): ClassRule => ({
  make: (value, side) => `${letter}${side}-${value}`,
  owns: (token, side) => token.replace(/^-/, '').startsWith(`${letter}${side}-`)
});

export type StyleProp = Exclude<LiveProp, LiveProp.Text | LiveProp.Class>;

export const CLASS_RULE: Record<StyleProp, ClassRule> = {
  [LiveProp.Color]: { make: (v) => `text-${v}`, owns: (t) => t.startsWith('text-') && !TEXT_SIZE.test(t) && !TEXT_NOT_COLOUR.test(t) },
  [LiveProp.Fill]: { make: (v) => `bg-${v}`, owns: (t) => t.startsWith('bg-') && !BG_NOT_COLOUR.test(t) },
  [LiveProp.FontSize]: { make: (v) => `text-${v}`, owns: (t) => TEXT_SIZE.test(t) },
  [LiveProp.FontWeight]: { make: (v) => `font-${v}`, owns: (t) => WEIGHT.test(t) },
  [LiveProp.Padding]: spacing('p'),
  [LiveProp.Margin]: spacing('m'),
  [LiveProp.Gap]: { make: (v, side) => `gap${side ? `-${side}` : ''}-${v}`, owns: (t, side) => t.startsWith(`gap${side ? `-${side}` : ''}-`) && (side !== Side.All || !/^gap-[xy]-/.test(t)) },
  [LiveProp.Radius]: { make: (v) => (v ? `rounded-${v}` : 'rounded'), owns: (t) => (t === 'rounded' || t.startsWith('rounded-')) && !RADIUS_SIDE.test(t) }
};

export enum ClassFamily {
  Opacity = 'opacity',
  Rotate = 'rotate',
  TranslateX = 'translate-x',
  TranslateY = 'translate-y',
  Width = 'width',
  Height = 'height',
  FlipX = 'flip-x',
  FlipY = 'flip-y',
  Hidden = 'hidden',
  Blend = 'blend',
  FontFamily = 'font-family',
  Tracking = 'tracking',
  Leading = 'leading',
  TextAlign = 'text-align',
  Case = 'case',
  Italic = 'italic',
  Decoration = 'decoration',
  Clamp = 'clamp',
  Direction = 'direction',
  Items = 'items',
  Justify = 'justify',
  Wrap = 'wrap',
  Shadow = 'shadow',
  Filter = 'filter',
  Backdrop = 'backdrop',
  Border = 'border'
}

const ARBITRARY_PROPERTY = /^\[([a-z-]+):/;

const startsWith = (...prefixes: string[]) => (t: string) => prefixes.some((p) => t.startsWith(p));
const oneOf = (...names: string[]) => (t: string) => names.includes(t);

export const CLASS_FAMILY: Record<ClassFamily, (token: string) => boolean> = {
  [ClassFamily.Opacity]: startsWith('opacity-'),
  [ClassFamily.Rotate]: startsWith('rotate-', '-rotate-'),
  [ClassFamily.TranslateX]: startsWith('translate-x-', '-translate-x-'),
  [ClassFamily.TranslateY]: startsWith('translate-y-', '-translate-y-'),
  [ClassFamily.Width]: startsWith('w-'),
  [ClassFamily.Height]: startsWith('h-'),
  [ClassFamily.FlipX]: startsWith('scale-x-', '-scale-x-'),
  [ClassFamily.FlipY]: startsWith('scale-y-', '-scale-y-'),
  [ClassFamily.Hidden]: oneOf('hidden', 'invisible', 'visible'),
  [ClassFamily.Blend]: startsWith('mix-blend-'),
  [ClassFamily.FontFamily]: (t) => /^font-(sans|serif|mono|\[['"])/.test(t),
  [ClassFamily.Tracking]: startsWith('tracking-'),
  [ClassFamily.Leading]: startsWith('leading-'),
  [ClassFamily.TextAlign]: oneOf('text-left', 'text-center', 'text-right', 'text-justify', 'text-start', 'text-end'),
  [ClassFamily.Case]: oneOf('uppercase', 'lowercase', 'capitalize', 'normal-case'),
  [ClassFamily.Italic]: oneOf('italic', 'not-italic'),
  [ClassFamily.Decoration]: oneOf('underline', 'line-through', 'overline', 'no-underline'),
  [ClassFamily.Clamp]: (t) => t === 'truncate' || t.startsWith('line-clamp-'),
  [ClassFamily.Direction]: oneOf('flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse'),
  [ClassFamily.Items]: startsWith('items-'),
  [ClassFamily.Justify]: (t) => t.startsWith('justify-') && !t.startsWith('justify-items-') && !t.startsWith('justify-self-'),
  [ClassFamily.Wrap]: oneOf('flex-wrap', 'flex-nowrap', 'flex-wrap-reverse'),
  [ClassFamily.Shadow]: (t) => t === 'shadow' || t.startsWith('shadow-'),
  [ClassFamily.Filter]: (t) => t === 'blur' || t.startsWith('blur-') || t.startsWith('[filter:'),
  [ClassFamily.Backdrop]: startsWith('backdrop-'),
  [ClassFamily.Border]: (t) => t === 'border' || /^border-(\d|\[\d)/.test(t) || t.startsWith('[border')
};

const BASE_VARIANT = '';
const MIN_WIDTH_PX: Record<string, number> = { [BASE_VARIANT]: 0, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

export const variantOf = (token: string) => token.slice(0, Math.max(0, token.lastIndexOf(':')));
export const utilityOf = (token: string) => token.slice(token.lastIndexOf(':') + 1);
const appliesAt = (token: string, viewport: number) => (MIN_WIDTH_PX[variantOf(token)] ?? Infinity) <= viewport;

export function activeIndex(parts: readonly string[], owns: (utility: string) => boolean, viewport: number): number {
  let best = -1;
  parts.forEach((token, at) => {
    if (!token.trim() || !appliesAt(token, viewport) || !owns(utilityOf(token))) {
      return;
    }
    if (best < 0 || MIN_WIDTH_PX[variantOf(token)] > MIN_WIDTH_PX[variantOf(parts[best])]) {
      best = at;
    }
  });
  return best;
}

const ARBITRARY_FAMILY = 'arbitrary:';

export const arbitraryFamily = (property: string) => `${ARBITRARY_FAMILY}${property}`;

const ownerOf = (family: string): ((token: string) => boolean) | null => {
  if (family.startsWith(ARBITRARY_FAMILY)) {
    const property = family.slice(ARBITRARY_FAMILY.length);
    return (token) => token.match(ARBITRARY_PROPERTY)?.[1] === property;
  }
  return CLASS_FAMILY[family as ClassFamily] ?? null;
};

export function familyRule(family: string): ClassRule | null {
  const owns = ownerOf(family);
  return owns ? { make: (value) => value, owns: (token) => owns(token) } : null;
}

export type LiveRect = { x: number; y: number; width: number; height: number };

export type LivePick = { source: string; rect: LiveRect; styles: Record<string, string>; classes: string; text: string | null; rem: number | null; viewport: number | null };

type InspectResult = { source: { file: string; line: number; col: number }; rect?: LiveRect; styles?: Record<string, string>; classes?: string; text?: string | null; rem?: number; viewport?: number };

const NO_RECT: LiveRect = { x: 0, y: 0, width: 0, height: 0 };

export function pickOf(result: InspectResult | null | undefined): LivePick | null {
  if (!result?.source) {
    return null;
  }
  const { file, line, col } = result.source;
  return { source: `${file}:${line}:${col}`, rect: result.rect ?? NO_RECT, styles: result.styles ?? {}, classes: result.classes ?? '', text: result.text ?? null, rem: result.rem ?? null, viewport: result.viewport ?? null };
}

export type LivePreview = { text?: string; style?: Record<string, string> };

export type LiveEditBody = { at: string; prop: LiveProp; side?: Side; family?: string; value: string; was: string; rem?: number; viewport?: number };
