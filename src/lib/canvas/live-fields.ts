export enum LiveProp {
  Text = 'text',
  Color = 'color',
  Fill = 'fill',
  FontSize = 'fontSize',
  FontWeight = 'fontWeight',
  Padding = 'padding',
  Margin = 'margin',
  Gap = 'gap',
  Radius = 'radius'
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

export const CLASS_RULE: Record<Exclude<LiveProp, LiveProp.Text>, ClassRule> = {
  [LiveProp.Color]: { make: (v) => `text-${v}`, owns: (t) => t.startsWith('text-') && !TEXT_SIZE.test(t) && !TEXT_NOT_COLOUR.test(t) },
  [LiveProp.Fill]: { make: (v) => `bg-${v}`, owns: (t) => t.startsWith('bg-') && !BG_NOT_COLOUR.test(t) },
  [LiveProp.FontSize]: { make: (v) => `text-${v}`, owns: (t) => TEXT_SIZE.test(t) },
  [LiveProp.FontWeight]: { make: (v) => `font-${v}`, owns: (t) => WEIGHT.test(t) },
  [LiveProp.Padding]: spacing('p'),
  [LiveProp.Margin]: spacing('m'),
  [LiveProp.Gap]: { make: (v, side) => `gap${side ? `-${side}` : ''}-${v}`, owns: (t, side) => t.startsWith(`gap${side ? `-${side}` : ''}-`) && (side !== Side.All || !/^gap-[xy]-/.test(t)) },
  [LiveProp.Radius]: { make: (v) => (v ? `rounded-${v}` : 'rounded'), owns: (t) => (t === 'rounded' || t.startsWith('rounded-')) && !RADIUS_SIDE.test(t) }
};

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

export type LiveEditBody = { at: string; prop: LiveProp; side?: Side; value: string; was: string; rem?: number; viewport?: number };
