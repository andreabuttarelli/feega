import { paintOf } from './colour';

export enum FillKind {
  Solid = 'solid',
  Linear = 'linear',
  Radial = 'radial',
  Conic = 'conic',
  Image = 'image'
}

export type Stop = { colour: string; at: string };

export type Fill =
  | { kind: FillKind.Solid; colour: string; visible: boolean }
  | { kind: FillKind.Linear; angle: string; stops: Stop[]; visible: boolean }
  | { kind: FillKind.Radial; shape: string; stops: Stop[]; visible: boolean }
  | { kind: FillKind.Conic; angle: string; stops: Stop[]; visible: boolean }
  | { kind: FillKind.Image; url: string; size: string; repeat: string; position: string; visible: boolean };

export type Placement = { size: string; repeat: string; position: string };

const NO_PLACEMENT: Placement = { size: '', repeat: '', position: '' };
const DEFAULT_SIZE = 'auto';
const DEFAULT_REPEAT = 'repeat';
const DEFAULT_POSITION = '0% 0%';
const CENTRED = '50% 50%';

const NONE = 'none';
const TRANSPARENT = 'transparent';
const GRADIENT = /^(linear|radial|conic)-gradient\((.*)\)$/;
const URL = /^url\(["']?([^"')]*)["']?\)$/;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?=\/)/;
const STOP = /^(.*?)\s+([-\d.]+(?:%|px)?)$/;
const DIRECTION = /^(to\s|-?[\d.]+(deg|turn|rad)|from\s|circle|ellipse|closest|farthest|at\s)/;

function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  return current.trim() ? [...parts, current.trim()] : parts;
}

const stopOf = (text: string): Stop => {
  const m = text.match(STOP);
  return m ? { colour: m[1].trim(), at: m[2] } : { colour: text.trim(), at: '' };
};

function gradientOf(kind: string, body: string): Fill {
  const args = splitTop(body);
  const head = DIRECTION.test(args[0]) ? args.shift()! : '';
  const stops = args.map(stopOf);
  const table: Record<string, () => Fill> = {
    linear: () => ({ kind: FillKind.Linear, angle: head || '180deg', stops, visible: true }),
    radial: () => ({ kind: FillKind.Radial, shape: head || 'ellipse', stops, visible: true }),
    conic: () => ({ kind: FillKind.Conic, angle: head || 'from 0deg', stops, visible: true })
  };
  return table[kind]();
}

function layerOf(text: string, place: Placement): Fill | null {
  const gradient = text.match(GRADIENT);
  if (gradient) {
    return gradientOf(gradient[1], gradient[2]);
  }
  const url = text.match(URL);
  return url ? { kind: FillKind.Image, url: url[1].replace(LOCAL_ORIGIN, ''), size: place.size || DEFAULT_SIZE, repeat: place.repeat || DEFAULT_REPEAT, position: place.position || DEFAULT_POSITION, visible: true } : null;
}

const placementAt = (placement: Placement, i: number): Placement => {
  const at = (list: string) => splitTop(list)[i] ?? '';
  return { size: at(placement.size), repeat: at(placement.repeat), position: at(placement.position) };
};

export function parseFills(image: string, colour: string, placement: Placement = NO_PLACEMENT): Fill[] {
  const layers = !image || image.trim() === NONE ? [] : splitTop(image).map((text, i) => layerOf(text, placementAt(placement, i))).filter((f): f is Fill => f !== null);
  const solid = paintOf(colour);
  return solid ? [...layers, { kind: FillKind.Solid, colour: colour.trim(), visible: true }] : layers;
}

const stopsCss = (stops: Stop[]) => stops.map((s) => (s.at ? `${s.colour} ${s.at}` : s.colour)).join(', ');

const LAYER_CSS: { [K in FillKind]: (f: Extract<Fill, { kind: K }>) => string } = {
  [FillKind.Solid]: (f) => f.colour,
  [FillKind.Linear]: (f) => `linear-gradient(${f.angle}, ${stopsCss(f.stops)})`,
  [FillKind.Radial]: (f) => `radial-gradient(${f.shape}, ${stopsCss(f.stops)})`,
  [FillKind.Conic]: (f) => `conic-gradient(${f.angle}, ${stopsCss(f.stops)})`,
  [FillKind.Image]: (f) => `url("${f.url}")`
};

export const layerCss = (fill: Fill): string => (LAYER_CSS[fill.kind] as (f: Fill) => string)(fill);

const isBlankImage = (fill: Fill) => fill.kind === FillKind.Image && !fill.url.trim();

export function fillCss(fills: Fill[]): Record<string, string> {
  const shown = fills.filter((f) => f.visible);
  const solid = shown.find((f) => f.kind === FillKind.Solid);
  const images = shown.filter((f) => f.kind !== FillKind.Solid && !isBlankImage(f)).map(layerCss);
  return { 'background-image': images.length ? images.join(', ') : NONE, 'background-color': solid ? layerCss(solid) : TRANSPARENT };
}

const painted = (fills: Fill[]) => fills.filter((f) => f.visible && f.kind !== FillKind.Solid && !isBlankImage(f));

const placementOf = (fill: Fill): Placement => (fill.kind === FillKind.Image ? fill : { size: DEFAULT_SIZE, repeat: DEFAULT_REPEAT, position: DEFAULT_POSITION });

export function placementCss(fills: Fill[]): Record<string, string> {
  const layers = painted(fills).map(placementOf);
  const list = (pick: (p: Placement) => string, none: string) => (layers.length ? layers.map(pick).join(', ') : none);
  return {
    'background-size': list((p) => p.size, DEFAULT_SIZE),
    'background-repeat': list((p) => p.repeat, DEFAULT_REPEAT),
    'background-position': list((p) => p.position, DEFAULT_POSITION)
  };
}

export const imageChanged = (was: string, next: string) => was.trim() !== NONE || next.trim() !== NONE;

export const arbitraryCss = (css: string) => css.replace(/,\s+/g, ',').replace(/\s+/g, '_');

const SINGLE_URL = /^url\(["']?([^"'()\s]+)["']?\)$/;

export function tailwindImage(css: string): string {
  const url = css.trim().match(SINGLE_URL);
  return url ? `bg-[url(${url[1]})]` : `[background-image:${arbitraryCss(css)}]`;
}

export function tailwindFill(fills: Fill[]): string[] {
  const css = fillCss(fills);
  return [css['background-image'], css['background-color']].filter((v) => v !== NONE && v !== TRANSPARENT).map((v) => `bg-[${arbitraryCss(v)}]`);
}

export function newFill(kind: FillKind): Fill {
  const stops = [
    { colour: '#ffffff', at: '0%' },
    { colour: '#000000', at: '100%' }
  ];
  const table: Record<FillKind, Fill> = {
    [FillKind.Solid]: { kind: FillKind.Solid, colour: '#d9d9d9', visible: true },
    [FillKind.Linear]: { kind: FillKind.Linear, angle: '90deg', stops, visible: true },
    [FillKind.Radial]: { kind: FillKind.Radial, shape: 'circle', stops, visible: true },
    [FillKind.Conic]: { kind: FillKind.Conic, angle: 'from 0deg', stops, visible: true },
    [FillKind.Image]: { kind: FillKind.Image, url: '', size: 'cover', repeat: 'no-repeat', position: CENTRED, visible: true }
  };
  return table[kind];
}

