import { BlendMode } from "../blend";
import { FillType, type Fill, type FillOf, type Stop } from "./model";

export type FillPaint = {
  id: string;
  size: { w: number; h: number };
  color: (value: string) => string;
  asset: (id: string | null) => string | null;
};

const DIGITS = 1000;
const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const LINK = /^(https?:|data:|blob:|\/)/;

const resolveStops = (stops: Stop[], color: FillPaint["color"]) =>
  stops.map((s) => ({ ...s, color: color(s.color) }));

const RESOLVE: {
  [T in FillType]: (
    f: FillOf<T>,
    color: FillPaint["color"],
    asset: FillPaint["asset"],
  ) => FillOf<T>;
} = {
  [FillType.Solid]: (f, color) => ({ ...f, color: color(f.color) }),
  [FillType.Linear]: (f, color) => ({
    ...f,
    stops: resolveStops(f.stops, color),
  }),
  [FillType.Radial]: (f, color) => ({
    ...f,
    stops: resolveStops(f.stops, color),
  }),
  [FillType.Image]: (f, _color, asset) => ({
    ...f,
    src:
      f.src ||
      asset(f.assetId || null) ||
      (LINK.test(f.assetId) ? f.assetId : ""),
  }),
};

export const resolveFills = (
  fills: readonly Fill[],
  color: FillPaint["color"],
  asset: FillPaint["asset"],
): Fill[] =>
  fills.map((f) =>
    (
      RESOLVE[f.type] as (
        f: Fill,
        c: FillPaint["color"],
        a: FillPaint["asset"],
      ) => Fill
    )(f, color, asset),
  );

type Point = { x: number; y: number };
type HtmlFill = {
  type: string;
  opacity: number;
  visible: boolean;
  blend: string;
  color?: string;
  stops?: Stop[];
  angle?: number;
  center?: Point;
  radius?: number;
  src?: string;
  fit?: string;
  focus?: Point;
  scale?: number;
};

export function fillLayersHtml(fills: readonly HtmlFill[]): string {
  const TILE_SHARE = 25;
  const PERCENT = 100;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const esc = (s: string) =>
    String(s).replace(
      /[&<>"]/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
          c
        ] as string,
    );
  const stopList = (stops: { color: string; pos: number }[]) =>
    stops
      .slice()
      .sort((a, b) => a.pos - b.pos)
      .map((s) => s.color + " " + r(s.pos * PERCENT) + "%")
      .join(",");
  const at = (p: { x: number; y: number }) =>
    r(p.x * PERCENT) + "% " + r(p.y * PERCENT) + "%";
  const layer = (f: HtmlFill, kind: string, style: string, inner = "") => {
    const look =
      (f.opacity < 1 ? ";opacity:" + r(f.opacity) : "") +
      (f.blend !== "normal" ? ";mix-blend-mode:" + f.blend : "");
    return (
      '<div class="fl fl-' +
      kind +
      '" style="position:absolute;inset:0' +
      look +
      (style ? ";" + style : "") +
      '">' +
      inner +
      "</div>"
    );
  };
  const image = (f: HtmlFill) => {
    if (!f.src) {
      return "";
    }
    const focus = at(f.focus!);
    const scale = f.scale!;
    if (f.fit === "tile") {
      return layer(
        f,
        "tile",
        "background-image:url(" +
          esc('"' + f.src + '"') +
          ");background-repeat:repeat;background-size:" +
          r(scale * TILE_SHARE) +
          "% auto;background-position:" +
          focus,
      );
    }
    const zoom =
      scale === 1
        ? ""
        : ";transform:scale(" + r(scale) + ");transform-origin:" + focus;
    return layer(
      f,
      "image",
      "",
      '<img class="fl-image" decoding="sync" draggable="false" src="' +
        esc(f.src) +
        '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:' +
        f.fit +
        ";object-position:" +
        focus +
        zoom +
        '">',
    );
  };
  const html = (f: HtmlFill): string => {
    if (!f.visible) {
      return "";
    }
    if (f.type === "solid") {
      return layer(f, "solid", "background:" + f.color!);
    }
    if (f.type === "linear-gradient") {
      return layer(
        f,
        "linear",
        "background:linear-gradient(" +
          r(f.angle! + 90) +
          "deg," +
          stopList(f.stops!) +
          ")",
      );
    }
    if (f.type === "radial-gradient") {
      return layer(
        f,
        "radial",
        "background:radial-gradient(circle calc(max(100cqw,100cqh) * " +
          r(f.radius! / 2) +
          ") at " +
          at(f.center!) +
          "," +
          stopList(f.stops!) +
          ")",
      );
    }
    return image(f);
  };
  return (
    '<div class="fls" style="position:absolute;inset:0;overflow:hidden;container-type:size">' +
    fills.map(html).join("") +
    "</div>"
  );
}

const gradientId = (id: string, i: number) => `sg-${id}-f${i}`;
const clipId = (id: string, i: number) => `sc-${id}-f${i}`;

const stopTags = (stops: Stop[], paint: FillPaint) =>
  [...stops]
    .sort((a, b) => a.pos - b.pos)
    .map(
      (s) =>
        `<stop offset="${round(s.pos)}" style="stop-color:${paint.color(s.color)}"/>`,
    )
    .join("");

type SvgLayer = { def: string; fill: string };

function linear(
  f: FillOf<FillType.Linear>,
  paint: FillPaint,
  i: number,
): SvgLayer {
  const { w, h } = paint.size;
  const a = (f.angle * Math.PI) / 180;
  const dx = (Math.cos(a) * w) / 2;
  const dy = (Math.sin(a) * h) / 2;
  const def = `<linearGradient id="${gradientId(paint.id, i)}" gradientUnits="userSpaceOnUse" x1="${round(w / 2 - dx)}" y1="${round(h / 2 - dy)}" x2="${round(w / 2 + dx)}" y2="${round(h / 2 + dy)}">${stopTags(f.stops, paint)}</linearGradient>`;
  return { def, fill: `url(#${gradientId(paint.id, i)})` };
}

function radial(
  f: FillOf<FillType.Radial>,
  paint: FillPaint,
  i: number,
): SvgLayer {
  const { w, h } = paint.size;
  const def = `<radialGradient id="${gradientId(paint.id, i)}" gradientUnits="userSpaceOnUse" cx="${round(f.center.x * w)}" cy="${round(f.center.y * h)}" r="${round((f.radius * Math.max(w, h)) / 2)}">${stopTags(f.stops, paint)}</radialGradient>`;
  return { def, fill: `url(#${gradientId(paint.id, i)})` };
}

const PAINTED: Record<
  Exclude<FillType, FillType.Image>,
  (f: never, paint: FillPaint, i: number) => SvgLayer
> = {
  [FillType.Solid]: (f: FillOf<FillType.Solid>, paint) => ({
    def: "",
    fill: paint.color(f.color),
  }),
  [FillType.Linear]: linear,
  [FillType.Radial]: radial,
};

const opacityAttr = (f: Fill) =>
  f.opacity < 1 ? ` opacity="${round(f.opacity)}"` : "";
const blendStyle = (f: Fill) =>
  f.blend === BlendMode.Normal ? "" : `;mix-blend-mode:${f.blend}`;

function imageLayer(
  f: FillOf<FillType.Image>,
  paint: FillPaint,
  paths: string,
  rule: string,
  i: number,
): { def: string; body: string } {
  const [resolved] = resolveFills(
    [{ ...f, opacity: 1, blend: BlendMode.Normal }],
    paint.color,
    paint.asset,
  );
  if (!(resolved as FillOf<FillType.Image>).src) {
    return { def: "", body: "" };
  }
  const { w, h } = paint.size;
  const look = blendStyle(f);
  return {
    def: `<clipPath id="${clipId(paint.id, i)}" clip-rule="${rule}">${paths}</clipPath>`,
    body: `<g${opacityAttr(f)}${look ? ` style="${look.slice(1)}"` : ""}><foreignObject x="0" y="0" width="${round(w)}" height="${round(h)}" clip-path="url(#${clipId(paint.id, i)})">${fillLayersHtml([resolved])}</foreignObject></g>`,
  };
}

export function svgFills(
  fills: readonly Fill[],
  paint: FillPaint,
  paths: string,
  rule: string,
): { defs: string; body: string } {
  const drawn = fills.map((f, i) => {
    if (!f.visible) {
      return { def: "", body: "" };
    }
    if (f.type === FillType.Image) {
      return imageLayer(f, paint, paths, rule, i);
    }
    const { def, fill } = PAINTED[f.type](f as never, paint, i);
    return {
      def,
      body: `<g style="fill:${fill};fill-rule:${rule};stroke:none${blendStyle(f)}"${opacityAttr(f)}>${paths}</g>`,
    };
  });
  return {
    defs: drawn.map((d) => d.def).join(""),
    body: drawn.map((d) => d.body).join(""),
  };
}
