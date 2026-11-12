import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { ShapeKind } from '@feega/motion-core/motion/shape/schema';
import { VarType, keyOf, splitKey, type Collection, type VarLiteral, type Variables } from '@feega/motion-core/motion/variables-model';
import { mapClips } from '$lib/canvas/code-look';
import { resolveVariables, variableValue, RADIUS_TARGET } from '$lib/motion/variables';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { StyleKind, type Style } from '@feega/motion-core/motion/styles-model';
import { defineStyle, slotOf } from '$lib/motion/styles';
import { lengthPx } from './design-tokens';
import { StyleField, type MadeStyles } from './design-styles';

export const DESIGN_BOARD = 'Design system';

const WIDTH = 1280;
const MARGIN = 64;
const COLUMNS = 4;
const CELL_W = (WIDTH - MARGIN * 2) / COLUMNS;
const SWATCH = 48;
const COLOUR_ROW = 72;
const RADIUS_SQUARE = 64;
const RADIUS_ROW = 112;
const SPACING_ROW = 40;
const TYPE_ROW = 64;
const HEADING_GAP = 48;
const SECTION_GAP = 40;
const LABEL_GAP = 16;
const BAR_HEIGHT = 16;
const MAX_BAR = WIDTH - MARGIN * 2 - 200;

const INK = { r: 0.067, g: 0.067, b: 0.067, a: 1 };
const SOFT = { r: 0.45, g: 0.45, b: 0.45, a: 1 };
const PAPER = { r: 1, g: 1, b: 1, a: 1 };
const LINE = { r: 0.88, g: 0.88, b: 0.88, a: 1 };
const BAR = { r: 0.8, g: 0.84, b: 0.95, a: 1 };

const FONT = 'Inter';

enum Size {
  Title = 32,
  Section = 20,
  Label = 14,
  Note = 12,
  Sample = 28
}

let serial = 0;
const id = () => `ds${++serial}`;

const solid = (color: typeof INK) => [{ type: 'SOLID', color }];

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

function rgbOf(hex: string) {
  const at = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return { r: at(0), g: at(1), b: at(2), a: hex.length > 7 ? at(3) : 1 };
}

function text(characters: string, x: number, y: number, size: Size, colour = INK, family = FONT, weight = 400): RestNode {
  const lineHeight = Math.round(size * 1.3);
  return { id: id(), type: 'TEXT', name: characters, characters, absoluteBoundingBox: box(x, y, Math.max(40, characters.length * size * 0.62), lineHeight), fills: solid(colour), style: { fontFamily: family, fontWeight: weight, fontSize: size, lineHeightPx: lineHeight } };
}

const rect = (name: string, x: number, y: number, width: number, height: number, fill: typeof INK, radius = 0): RestNode => ({ id: id(), type: 'RECTANGLE', name, absoluteBoundingBox: box(x, y, width, height), fills: solid(fill), strokes: solid(LINE), strokeWeight: 1, cornerRadius: radius });

const shortKey = (key: string) => splitKey(key)?.[0].split(' ').slice(-1)[0] + '/' + splitKey(key)?.[1];

type Entry = { key: string; name: string; collection: Collection };

function entriesOf(variables: Variables, type: VarType, group?: RegExp): Entry[] {
  return Object.entries(variables)
    .filter(([name]) => !group || group.test(name))
    .flatMap(([collectionName, collection]) => Object.entries(collection.vars).filter(([, v]) => v.type === type).map(([name]) => ({ key: keyOf(collectionName, name), name, collection })));
}

const READ_ONLY_LABEL = 'read-only';

type Sheet = { variables: Variables; scale: number; readOnly: ReadonlySet<string>; styled?: MadeStyles };

const noted = (sheet: Sheet, entry: Entry, line: string) => (sheet.readOnly.has(entry.key) ? `${line} · ${READ_ONLY_LABEL}` : line);

function modesLine(entry: Entry): string {
  const raw = entry.collection.vars[entry.name].values;
  const alias = Object.values(raw).find((v) => typeof v === 'object' && v !== null) as { alias: string } | undefined;
  if (alias) {
    return `→ ${shortKey(alias.alias)}`;
  }
  return entry.collection.modes.map((m) => `${m} ${String(raw[m])}`).join(' · ');
}

type Section = { nodes: RestNode[]; height: number };

function colours(sheet: Sheet, top: number): Section {
  const { variables } = sheet;
  const list = entriesOf(variables, VarType.Colour);
  const nodes = list.flatMap((entry, i) => {
    const x = MARGIN + (i % COLUMNS) * CELL_W;
    const y = top + Math.floor(i / COLUMNS) * COLOUR_ROW;
    const value = String(variableValue(variables, entry.key) ?? '#000000');
    return [rect(entry.key, x, y, SWATCH, SWATCH, rgbOf(value), 6), text(entry.name, x + SWATCH + 12, y + 4, Size.Label, INK, FONT, 500), text(noted(sheet, entry, modesLine(entry)), x + SWATCH + 12, y + 26, Size.Note, SOFT)];
  });
  return { nodes, height: Math.ceil(list.length / COLUMNS) * COLOUR_ROW };
}

const pxOf = (value: VarLiteral | undefined, scale: number) => Math.round((Number(value ?? 0) / scale) * 100) / 100;

function radii(sheet: Sheet, top: number): Section {
  const { variables, scale } = sheet;
  const list = entriesOf(variables, VarType.Number, /Radius$/);
  const nodes = list.flatMap((entry, i) => {
    const x = MARGIN + (i % COLUMNS) * CELL_W;
    const y = top + Math.floor(i / COLUMNS) * RADIUS_ROW;
    const px = pxOf(variableValue(variables, entry.key), scale);
    return [rect(entry.key, x, y, RADIUS_SQUARE, RADIUS_SQUARE, BAR, px), text(entry.name, x + RADIUS_SQUARE + 12, y + 12, Size.Label, INK, FONT, 500), text(noted(sheet, entry, `${px}px`), x + RADIUS_SQUARE + 12, y + 34, Size.Note, SOFT)];
  });
  return { nodes, height: Math.ceil(list.length / COLUMNS) * RADIUS_ROW };
}

const bars = (group: RegExp) => (sheet: Sheet, top: number): Section => {
  const { variables, scale } = sheet;
  const list = entriesOf(variables, VarType.Number, group);
  const nodes = list.flatMap((entry, i) => {
    const y = top + i * SPACING_ROW;
    const px = pxOf(variableValue(variables, entry.key), scale);
    return [text(entry.name, MARGIN, y, Size.Label, INK, FONT, 500), text(noted(sheet, entry, `${px}px`), MARGIN + 120, y, Size.Note, SOFT), rect(`${entry.key} bar`, MARGIN + 200, y + 2, Math.max(1, Math.min(MAX_BAR, px)), BAR_HEIGHT, BAR)];
  });
  return { nodes, height: list.length * SPACING_ROW };
};

const firstFamily = (stack: string) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || FONT;

function families(sheet: Sheet, top: number): Section {
  const { variables } = sheet;
  const list = entriesOf(variables, VarType.String, /Type$/);
  const nodes = list.flatMap((entry, i) => {
    const y = top + i * TYPE_ROW;
    const stack = String(variableValue(variables, entry.key) ?? '');
    return [text(entry.name, MARGIN, y + 8, Size.Label, INK, FONT, 500), text('Aa Bb Cc 0123', MARGIN + 160, y, Size.Sample, INK, firstFamily(stack)), text(noted(sheet, entry, stack), MARGIN + 520, y + 10, Size.Note, SOFT)];
  });
  return { nodes, height: list.length * TYPE_ROW };
}

const SAMPLE = 'Aa Bb Cc 0123';
const SHADOW_CARD = { width: 160, height: 96 };
const SHADOW_ROW = 160;

const stylesOfKind = (sheet: Sheet, kind: StyleKind) => Object.entries(sheet.styled?.styles ?? {}).filter(([, s]) => s.kind === kind);

function typeLine(sheet: Sheet, name: string, style: Style): string {
  const raw = sheet.styled?.map[`${name}#${StyleField.Size}`]?.raw.Light;
  const px = raw === undefined ? null : lengthPx(raw);
  const own = style as Record<string, unknown>;
  return [px === null ? null : `${px}px`, own.leading, own.weight].filter((v) => v !== null && v !== undefined).join(' · ');
}

function textStyles(sheet: Sheet, top: number): Section {
  const list = stylesOfKind(sheet, StyleKind.Text);
  const nodes = list.flatMap(([name, style], i) => {
    const y = top + i * TYPE_ROW;
    const sample = { ...text(SAMPLE, MARGIN + 240, y, Size.Sample), name };
    return [text(name.split('/').pop()!, MARGIN, y + 8, Size.Label, INK, FONT, 500), sample, text(typeLine(sheet, name, style), MARGIN + 760, y + 10, Size.Note, SOFT)];
  });
  return { nodes, height: list.length * TYPE_ROW };
}

function shadows(sheet: Sheet, top: number): Section {
  const list = stylesOfKind(sheet, StyleKind.Effect);
  const nodes = list.flatMap(([name], i) => {
    const x = MARGIN + (i % COLUMNS) * CELL_W;
    const y = top + Math.floor(i / COLUMNS) * SHADOW_ROW;
    return [rect(name, x, y, SHADOW_CARD.width, SHADOW_CARD.height, PAPER, 8), text(name.split('/').pop()!, x, y + SHADOW_CARD.height + 12, Size.Label, INK, FONT, 500)];
  });
  return { nodes, height: Math.ceil(list.length / COLUMNS) * SHADOW_ROW };
}

function others(sheet: Sheet, top: number): Section {
  const { variables, scale } = sheet;
  const list = [...entriesOf(variables, VarType.Number, /Other$/), ...entriesOf(variables, VarType.String, /Other$/)];
  const nodes = list.flatMap((entry, i) => {
    const y = top + i * SPACING_ROW;
    const value = variableValue(variables, entry.key);
    const shown = typeof value === 'number' ? `${pxOf(value, scale)}px` : String(value ?? '');
    return [text(entry.name, MARGIN, y, Size.Label, INK, FONT, 500), text(noted(sheet, entry, shown), MARGIN + 200, y, Size.Note, SOFT)];
  });
  return { nodes, height: list.length * SPACING_ROW };
}

type Part = { title: string; build: (sheet: Sheet, top: number) => Section };

const PARTS: Part[] = [
  { title: 'Colors', build: colours },
  { title: 'Radius', build: radii },
  { title: 'Spacing', build: bars(/Spacing$/) },
  { title: 'Type', build: families },
  { title: 'Text', build: textStyles },
  { title: 'Shadow', build: shadows },
  { title: 'Other', build: others }
];

export function designBoard(variables: Variables, scale = 1, readOnly: ReadonlySet<string> = new Set(), styled?: MadeStyles): PageTree {
  const children: RestNode[] = [text(DESIGN_BOARD, MARGIN, MARGIN, Size.Title, INK, FONT, 600)];
  let y = MARGIN + HEADING_GAP + LABEL_GAP;
  for (const part of PARTS) {
    const section = part.build({ variables, scale, readOnly, styled }, y + Size.Section + LABEL_GAP * 2);
    if (!section.nodes.length) {
      continue;
    }
    children.push(text(part.title, MARGIN, y, Size.Section, INK, FONT, 600), ...section.nodes);
    y += Size.Section + LABEL_GAP * 2 + section.height + SECTION_GAP;
  }
  const height = y + MARGIN;
  return { title: DESIGN_BOARD, url: 'about:blank', width: WIDTH, height, truncated: false, root: { id: id(), type: 'FRAME', name: DESIGN_BOARD, absoluteBoundingBox: box(0, 0, WIDTH, height), fills: solid(PAPER), children } };
}

const BOARD_TARGETS: Record<VarType, (clip: MotionClip) => string | null> = {
  [VarType.Colour]: () => 'fill',
  [VarType.Number]: (clip) => (clip.props.shape === ShapeKind.Rect || clip.props.shape === ShapeKind.Path ? RADIUS_TARGET : null),
  [VarType.String]: () => null,
  [VarType.Boolean]: () => null
};

function swatchBound(clip: MotionClip, variables: Variables): MotionClip {
  const at = clip.component === 'Shape' && clip.name ? splitKey(clip.name) : null;
  const variable = at ? variables[at[0]]?.vars[at[1]] : undefined;
  const target = variable ? BOARD_TARGETS[variable.type](clip) : null;
  if (!target) {
    return clip;
  }
  const rect = target === RADIUS_TARGET ? { shape: ShapeKind.Rect, path: '', corners: [] } : {};
  return { ...clip, props: { ...clip.props, ...rect }, bind: { ...clip.bind, [target]: clip.name! } };
}

const STYLED_COMPONENT: Record<StyleKind, string | null> = {
  [StyleKind.Text]: 'Text',
  [StyleKind.Effect]: 'Shape',
  [StyleKind.Colour]: null,
  [StyleKind.Paint]: null
};

function sampleStyled(clip: MotionClip, styles: Record<string, Style>): MotionClip {
  const style = clip.name ? styles[clip.name] : undefined;
  return style && STYLED_COMPONENT[style.kind] === clip.component ? { ...clip, [slotOf(style.kind)]: clip.name } : clip;
}

function withBoardStyles(doc: MotionDoc): MotionDoc {
  const styles = doc.styles ?? {};
  let next = mapClips(doc, (c) => (c.source ? c : sampleStyled(c, styles)));
  for (const [name, style] of Object.entries(styles)) {
    const painted = defineStyle(next, name, style);
    next = painted.ok ? painted.doc : next;
  }
  return next;
}

export function boardBound(doc: MotionDoc): MotionDoc {
  const variables = doc.variables;
  const styled = doc.styles ? withBoardStyles(doc) : doc;
  return variables ? resolveVariables(mapClips(styled, (c) => (c.source ? c : swatchBound(c, variables)))) : styled;
}
