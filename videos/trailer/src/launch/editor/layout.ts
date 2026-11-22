export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const WIN = { w: 1280, h: 760 };
export const TOP_ROW = 40;
export const LEFT_W = 260;
export const RIGHT_W = 300;
export const RIGHT_X = WIN.w - RIGHT_W;
export const BODY_Y = TOP_ROW;
export const PAGE: Rect = { x: LEFT_W, y: BODY_Y, w: RIGHT_X - LEFT_W, h: WIN.h - BODY_Y };

export const LAYER_ROW = 26;
export const LAYERS_TOP = BODY_Y + 6;

export const H1_TOP = 120;
export const H1_LEFT = 40;
export const H1_W = 470;
export const BASE_FONT = 64;

export const h1Rect = (fontSize: number): Rect => ({ x: PAGE.x + H1_LEFT, y: PAGE.y + H1_TOP, w: H1_W, h: fontSize * 2 });

export const ACTIONS_GAP = 150;
export const insertY = (fontSize: number) => PAGE.y + H1_TOP + fontSize * 2 + ACTIONS_GAP;

export enum Tab {
  Properties = "Properties",
  Changes = "Changes",
  Comments = "Comments",
}

export const TABS: Record<Tab, Rect> = {
  [Tab.Properties]: { x: RIGHT_X + 8, y: 7, w: 82, h: 26 },
  [Tab.Changes]: { x: RIGHT_X + 94, y: 7, w: 74, h: 26 },
  [Tab.Comments]: { x: RIGHT_X + 172, y: 7, w: 82, h: 26 },
};

export enum Control {
  Segmented = "segmented",
  Field = "field",
  Pair = "pair",
  Triple = "triple",
  Select = "select",
  Colour = "colour",
  Swatches = "swatches",
}

export type PropRow = { label: string; control: Control; values: string[] };
export type PropSection = { title: string; rows: PropRow[]; badge?: string };

export const TEXT_PROPS: PropSection[] = [
  { title: "Size", rows: [{ label: "Size", control: Control.Pair, values: ["W", "560", "px", "H", "128", "px"] }] },
  { title: "Spacing", rows: [{ label: "Padding", control: Control.Field, values: ["▢", "Mixed", "px"] }, { label: "Margin", control: Control.Field, values: ["▢", "0", "px"] }] },
  {
    title: "Typography",
    rows: [
      { label: "Font", control: Control.Select, values: ["Georgia", "Medium 500"] },
      { label: "Size", control: Control.Triple, values: ["Aa", "64", "px", "↕", "64", "px", "↔", "-3", "%"] },
      { label: "Align", control: Control.Segmented, values: ["alignStart", "alignCenter", "alignEnd", "alignJustify"] },
      { label: "Solid", control: Control.Colour, values: ["#2a1c12"] },
    ],
  },
  { title: "Radius", rows: [] },
  { title: "Effects", rows: [{ label: "Opacity", control: Control.Field, values: ["◐", "100", "%"] }] },
];

export const MESH_PROPS: PropSection[] = [
  { title: "Mesh gradient", badge: "plugin", rows: [{ label: "Points", control: Control.Field, values: ["◎", "4", ""] }, { label: "Colours", control: Control.Swatches, values: ["#ff5100", "#ffb36b", "#004dff", "#c026d3"] }, { label: "Blur", control: Control.Field, values: ["◌", "62", "%"] }, { label: "Noise", control: Control.Field, values: ["▦", "6", "%"] }] },
  { title: "Size", rows: [{ label: "Size", control: Control.Pair, values: ["W", "Fill", "", "H", "420", "px"] }] },
  { title: "Spacing", rows: [{ label: "Padding", control: Control.Field, values: ["▢", "56 40", "px"] }] },
  { title: "Effects", rows: [{ label: "Opacity", control: Control.Field, values: ["◐", "100", "%"] }] },
];

export const WHAT_H = 72;
export const EDITING_H = 34;
export const SCOPE_H = 38;
export const HEAD_H = 30;
export const ROW_H = 34;
export const LABEL_W = 72;
export const SIDE_PAD = 12;
export const CONTROL_X = RIGHT_X + SIDE_PAD + LABEL_W + 8;
export const CONTROL_W = WIN.w - SIDE_PAD - CONTROL_X;
export const FIELD_H = 28;
export const GAP = 4;
export const STATE_Y = BODY_Y + WHAT_H + EDITING_H + SCOPE_H;

export type PlacedRow = PropRow & { y: number };
export type PlacedSection = PropSection & { y: number; placed: PlacedRow[] };

export const placeProps = (sections: PropSection[]): PlacedSection[] => {
  let y = STATE_Y + ROW_H + 4;

  return sections.map((section) => {
    const top = y;
    y += HEAD_H;
    const placed = section.rows.map((row) => {
      const at = y;
      y += ROW_H;
      return { ...row, y: at };
    });
    y += 4;

    return { ...section, y: top, placed };
  });
};

export const controlRect = (row: PlacedRow, part = 0, parts = 1): Rect => {
  const w = (CONTROL_W - GAP * (parts - 1)) / parts;
  return { x: CONTROL_X + part * (w + GAP), y: row.y + (ROW_H - FIELD_H) / 2, w, h: FIELD_H };
};

const rowOf = (sections: PropSection[], title: string, label: string) => {
  const section = placeProps(sections).find((s) => s.title === title);
  const row = section?.placed.find((r) => r.label === label);

  if (!row) {
    throw new Error(`no row ${title}/${label}`);
  }

  return row;
};

export const FONT_SIZE_FIELD = controlRect(rowOf(TEXT_PROPS, "Typography", "Size"), 0, 3);
export const COLOUR_FIELD = controlRect(rowOf(TEXT_PROPS, "Typography", "Solid"));
export const BLUR_FIELD = controlRect(rowOf(MESH_PROPS, "Mesh gradient", "Blur"));

export const POPOVER: Rect = { x: RIGHT_X - 236, y: COLOUR_FIELD.y - 92, w: 228, h: 96 };
export const SWATCH = 30;
export const SWATCH_STEP = 42;
export const swatchRect = (i: number): Rect => ({ x: POPOVER.x + 14 + i * SWATCH_STEP, y: POPOVER.y + 48, w: SWATCH, h: SWATCH });

export const LIBRARY_TOP = BODY_Y + 112;
export const LIB_W = 112;
export const LIB_H = 112;
export const LIB_GAP = 12;
export const libraryRect = (i: number): Rect => ({ x: SIDE_PAD + (i % 2) * (LIB_W + LIB_GAP), y: LIBRARY_TOP + Math.floor(i / 2) * (LIB_H + LIB_GAP), w: LIB_W, h: LIB_H });

export const MESH_BOX: Rect = { x: PAGE.x + 24, y: PAGE.y + 86, w: PAGE.w - 48, h: 360 };

export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export const toStage = (r: Rect, origin: Point, scale: number): Rect => ({ x: origin.x + r.x * scale, y: origin.y + r.y * scale, w: r.w * scale, h: r.h * scale });
