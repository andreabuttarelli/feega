import type { ColorStop, Effect, FigmaMessage, FigmaRawNode, Guid, Matrix, Paint, Rgba, Vec } from '$lib/canvas/figma/archive';

export type RestColor = { r: number; g: number; b: number; a?: number };

export type RestPaint = {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: RestColor;
  imageRef?: string;
  gradientHandlePositions?: Vec[];
  gradientStops?: { position: number; color: RestColor }[];
};

export type RestStyle = {
  fontFamily?: string;
  fontWeight?: number;
  italic?: boolean;
  fontSize?: number;
  textAlignHorizontal?: string;
  letterSpacing?: number;
  lineHeightUnit?: string;
  lineHeightPx?: number;
  lineHeightPercentFontSize?: number;
  fills?: RestPaint[];
};

export type RestNode = {
  id: string;
  name?: string;
  type: string;
  visible?: boolean;
  opacity?: number;
  size?: Vec;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  relativeTransform?: number[][];
  fills?: RestPaint[];
  strokes?: RestPaint[];
  strokeWeight?: number;
  strokeAlign?: string;
  effects?: (Omit<Effect, 'color'> & { color?: RestColor })[];
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  clipsContent?: boolean;
  layoutMode?: string;
  layoutWrap?: string;
  itemSpacing?: number;
  counterAxisSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  layoutGrow?: number;
  layoutAlign?: string;
  layoutPositioning?: string;
  fillGeometry?: { path: string; windingRule?: string }[];
  strokeGeometry?: { path: string; windingRule?: string }[];
  characters?: string;
  style?: RestStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, RestStyle>;
  children?: RestNode[];
};

const PAGE_ID = 1;
const HUG = 'RESIZE_TO_FIT';
const FIXED = 'FIXED';
const FLOAT_BYTES = 4;
const POSITION_DIGITS = 6;
const SPACING_PIXELS = 'PIXELS';
const PATH_TOKEN = /[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi;

const PATH_COMMANDS: Record<string, { code: number; floats: number }> = {
  Z: { code: 0, floats: 0 },
  M: { code: 1, floats: 2 },
  L: { code: 2, floats: 2 },
  Q: { code: 3, floats: 4 },
  C: { code: 4, floats: 6 }
};

const WEIGHT_NAMES: Record<number, string> = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
const DEFAULT_WEIGHT = 400;

const IDENTITY: Matrix = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };

const rgba = (c: RestColor | undefined): Rgba => ({ r: c?.r ?? 0, g: c?.g ?? 0, b: c?.b ?? 0, a: c?.a ?? 1 });

function bytesOf(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{1,2}/g) ?? [], (pair) => parseInt(pair, 16));
}

function pathBlob(paths: string[]): Uint8Array {
  const parts: number[][] = [];
  for (const path of paths) {
    const tokens = path.match(PATH_TOKEN) ?? [];
    let at = 0;
    while (at < tokens.length) {
      const command = PATH_COMMANDS[tokens[at].toUpperCase()];
      if (!command) {
        return new Uint8Array();
      }
      parts.push([command.code, ...tokens.slice(at + 1, at + 1 + command.floats).map(Number)]);
      at += 1 + command.floats;
    }
  }

  const blob = new Uint8Array(parts.reduce((sum, p) => sum + 1 + (p.length - 1) * FLOAT_BYTES, 0));
  const view = new DataView(blob.buffer);
  let offset = 0;
  for (const [code, ...floats] of parts) {
    blob[offset++] = code;
    for (const value of floats) {
      view.setFloat32(offset, value, true);
      offset += FLOAT_BYTES;
    }
  }
  return blob;
}

function inverse(m: Matrix): Matrix {
  const det = m.m00 * m.m11 - m.m01 * m.m10 || 1;
  return {
    m00: m.m11 / det,
    m01: -m.m01 / det,
    m02: (m.m01 * m.m12 - m.m11 * m.m02) / det,
    m10: -m.m10 / det,
    m11: m.m00 / det,
    m12: (m.m10 * m.m02 - m.m00 * m.m12) / det
  };
}

function gradientTransform(handles: Vec[] | undefined): Matrix {
  const [start, end, width] = handles ?? [];
  if (!start || !end || !width) {
    return IDENTITY;
  }
  const [x, y] = [{ x: end.x - start.x, y: end.y - start.y }, { x: 2 * (width.x - start.x), y: 2 * (width.y - start.y) }];
  return inverse({ m00: x.x, m01: y.x, m02: start.x - y.x / 2, m10: x.y, m11: y.y, m12: start.y - y.y / 2 });
}

function paintOf(p: RestPaint): Paint {
  const stops: ColorStop[] | undefined = p.gradientStops?.map((s) => ({ position: s.position, color: rgba(s.color) }));
  return {
    type: p.type,
    visible: p.visible,
    opacity: p.opacity,
    color: p.color ? rgba(p.color) : undefined,
    stops,
    transform: stops ? gradientTransform(p.gradientHandlePositions) : undefined,
    image: p.imageRef ? { hash: bytesOf(p.imageRef) } : undefined
  };
}

const paintsOf = (paints: RestPaint[] | undefined) => paints?.map(paintOf);

const sizing = (mode: string | undefined) => (mode === 'AUTO' ? HUG : FIXED);

function fontOf(style: RestStyle | undefined) {
  if (!style?.fontFamily && !style?.fontWeight) {
    return undefined;
  }
  const weight = WEIGHT_NAMES[style.fontWeight ?? DEFAULT_WEIGHT] ?? 'Regular';
  return { family: style.fontFamily ?? 'Inter', style: style.italic ? `${weight} Italic` : weight };
}

function lineHeightOf(style: RestStyle | undefined) {
  if (style?.lineHeightUnit === SPACING_PIXELS) {
    return { value: style.lineHeightPx ?? 0, units: 'PIXELS' };
  }
  if (style?.lineHeightUnit === 'FONT_SIZE_%') {
    return { value: style.lineHeightPercentFontSize ?? 100, units: 'PERCENT' };
  }
  return undefined;
}

function textOf(n: RestNode): Partial<FigmaRawNode> {
  const overrides = Object.entries(n.styleOverrideTable ?? {}).map(([id, style]): FigmaRawNode => ({
    guid: { sessionID: 0, localID: 0 },
    styleID: Number(id),
    fontName: fontOf(style),
    fontSize: style.fontSize,
    fillPaints: paintsOf(style.fills)
  }));
  const style = n.style;
  return {
    fontName: fontOf(style),
    fontSize: style?.fontSize,
    lineHeight: lineHeightOf(style),
    letterSpacing: style?.letterSpacing ? { value: style.letterSpacing, units: 'PIXELS' } : undefined,
    textAlignHorizontal: style?.textAlignHorizontal,
    textData: { characters: n.characters ?? '', characterStyleIDs: n.characterStyleOverrides, styleOverrideTable: overrides }
  };
}

function layoutOf(n: RestNode): Partial<FigmaRawNode> {
  return {
    stackMode: n.layoutMode,
    stackWrap: n.layoutWrap,
    stackSpacing: n.itemSpacing,
    stackCounterSpacing: n.counterAxisSpacing,
    stackHorizontalPadding: n.paddingLeft,
    stackPaddingRight: n.paddingRight,
    stackVerticalPadding: n.paddingTop,
    stackPaddingBottom: n.paddingBottom,
    stackPrimaryAlignItems: n.primaryAxisAlignItems,
    stackCounterAlignItems: n.counterAxisAlignItems,
    stackPrimarySizing: sizing(n.primaryAxisSizingMode),
    stackCounterSizing: sizing(n.counterAxisSizingMode),
    stackChildPrimaryGrow: n.layoutGrow,
    stackChildAlignSelf: n.layoutAlign,
    stackPositioning: n.layoutPositioning
  };
}

function cornersOf(n: RestNode): Partial<FigmaRawNode> {
  const [tl, tr, br, bl] = n.rectangleCornerRadii ?? [];
  if (n.rectangleCornerRadii) {
    return { rectangleCornerRadiiIndependent: true, rectangleTopLeftCornerRadius: tl, rectangleTopRightCornerRadius: tr, rectangleBottomRightCornerRadius: br, rectangleBottomLeftCornerRadius: bl };
  }
  return { cornerRadius: n.cornerRadius };
}

function transformOf(n: RestNode, parent: RestNode | null): Matrix {
  const rows = n.relativeTransform;
  if (rows) {
    return { m00: rows[0][0], m01: rows[0][1], m02: rows[0][2], m10: rows[1][0], m11: rows[1][1], m12: rows[1][2] };
  }
  const [box, around] = [n.absoluteBoundingBox, parent?.absoluteBoundingBox];
  return { ...IDENTITY, m02: box ? box.x - (around?.x ?? 0) : 0, m12: box ? box.y - (around?.y ?? 0) : 0 };
}

const sizeOf = (n: RestNode): Vec => n.size ?? { x: n.absoluteBoundingBox?.width ?? 0, y: n.absoluteBoundingBox?.height ?? 0 };

const positionOf = (index: number) => String(index).padStart(POSITION_DIGITS, '0');

type Build = { nodes: FigmaRawNode[]; blobs: Uint8Array[]; next: () => Guid };

function geometryOf(list: { path: string; windingRule?: string }[] | undefined, build: Build): { commandsBlob: number }[] | undefined {
  if (!list?.length) {
    return undefined;
  }
  build.blobs.push(pathBlob(list.map((g) => g.path)));
  return [{ commandsBlob: build.blobs.length - 1 }];
}

function add(n: RestNode, parent: { rest: RestNode | null; guid: Guid }, index: number, build: Build) {
  const guid = build.next();
  build.nodes.push({
    guid,
    type: n.type,
    name: n.name,
    visible: n.visible,
    opacity: n.opacity,
    size: sizeOf(n),
    transform: transformOf(n, parent.rest),
    parentIndex: { guid: parent.guid, position: positionOf(index) },
    fillPaints: paintsOf(n.fills),
    strokePaints: paintsOf(n.strokes),
    strokeWeight: n.strokeWeight,
    strokeAlign: n.strokeAlign,
    effects: n.effects?.map((e) => ({ ...e, color: e.color ? rgba(e.color) : undefined })),
    frameMaskDisabled: n.clipsContent === undefined ? undefined : !n.clipsContent,
    fillGeometry: geometryOf(n.fillGeometry, build),
    strokeGeometry: geometryOf(n.strokeGeometry, build),
    ...cornersOf(n),
    ...layoutOf(n),
    ...(n.type === 'TEXT' ? textOf(n) : {})
  });
  (n.children ?? []).forEach((child, i) => add(child, { rest: n, guid }, i, build));
}

export function restMessage(frames: RestNode[], fileKey: string): FigmaMessage {
  let counter = PAGE_ID;
  const page: Guid = { sessionID: 0, localID: PAGE_ID };
  const build: Build = { nodes: [{ guid: page, type: 'CANVAS', name: 'Page' }], blobs: [], next: () => ({ sessionID: 0, localID: ++counter }) };
  frames.forEach((frame, i) => add(frame, { rest: null, guid: page }, i, build));
  return { meta: { fileKey }, nodes: build.nodes, blobs: build.blobs };
}
