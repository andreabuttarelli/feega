import { describe, expect, it } from "vitest";
import { apply2d } from "@feega/motion-core/motion/affine";
import { FillRule, PaintKind } from "@feega/motion-core/motion/gpu-full/paint";
import {
  DomGap,
  DrawnKind,
  readTree,
  type DrawnPath,
} from "@feega/motion-core/motion/gpu-full/dom/read";
import {
  NO_INDEX,
  type RawNode,
  type RawTree,
} from "@feega/motion-core/motion/gpu-full/dom/tree";
import { boxBook } from "../text/test-face";
import { Smoothing } from "@feega/motion-core/motion/gpu-full/text/painter";
import { BlendMode } from "@feega/motion-core/motion/blend";
import { MaskMode } from "@feega/motion-core/motion/mask";
import { CoverKind } from "@feega/motion-core/motion/gpu-full/mask-layers";
import { FilterKind } from "@feega/motion-core/motion/gpu-full/filters";
import type { SvgNode } from "@feega/motion-core/motion/effects/registry";

const FRAME = { width: 400, height: 300 };

function el(part: Partial<RawNode> & { parent: number }): RawNode {
  return {
    tag: "div",
    svg: false,
    at: [0, 0],
    size: [0, 0],
    style: {},
    attrs: {},
    text: "",
    lines: [],
    raster: null,
    layer: NO_INDEX,
    ...part,
  };
}

const root = (style: RawNode["style"] = {}) =>
  el({ parent: NO_INDEX, size: [FRAME.width, FRAME.height], style });
const tree = (...nodes: RawNode[]): RawTree => ({ ...FRAME, nodes, defs: {} });
const paths = (t: RawTree) =>
  readTree(t).drawn.filter((d): d is DrawnPath => d.kind === DrawnKind.Path);

function bounds(item: DrawnPath) {
  const pts = item.contours.flatMap((c) =>
    Array.from({ length: c.length / 2 }, (_, i) =>
      apply2d(item.matrix, [c[2 * i], c[2 * i + 1]]),
    ),
  );
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

const near = (b: ReturnType<typeof bounds>) =>
  Object.fromEntries(
    Object.entries(b).map(([k, v]) => [k, Math.round(v * 100) / 100]),
  );

describe("readTree", () => {
  it("leaves the root z-index to the order of clips and stacks the ones inside", () => {
    const box = el({
      parent: 0,
      size: [10, 10],
      style: { "background-color": "rgb(0, 0, 0)" },
    });

    expect(readTree(tree(root({ "z-index": "3" }), box))).toMatchObject({
      gaps: [],
      drawn: [{ kind: DrawnKind.Path }],
    });
    expect(
      readTree(
        tree(root(), { ...box, style: { ...box.style, "z-index": "3" } }),
      ).gaps,
    ).toEqual([]);
  });

  it("fills a box background at its position inside its parents", () => {
    const t = tree(
      root(),
      el({ parent: 0, at: [10, 20], size: [100, 100] }),
      el({
        parent: 1,
        at: [5, 5],
        size: [30, 40],
        style: { "background-color": "rgb(255, 0, 0)" },
      }),
    );

    const [box] = paths(t);

    expect(near(bounds(box))).toEqual({
      left: 15,
      top: 25,
      right: 45,
      bottom: 65,
    });
    expect(box.paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
  });

  it("snaps an upright box to whole device pixels, as the browser paints backgrounds", () => {
    const box = el({
      parent: 0,
      at: [10.4, 20.6],
      size: [30.2, 40],
      style: { "background-color": "rgb(0, 0, 0)" },
    });

    expect(near(bounds(paths(tree(root(), box))[0]))).toEqual({
      left: 10,
      top: 21,
      right: 41,
      bottom: 61,
    });
  });

  it("cuts a hard-stop gradient into solid bands, one path per colour across all tiles", () => {
    const grid = el({
      parent: 0,
      at: [0, 0],
      size: [100, 50],
      style: {
        "background-image":
          "linear-gradient(rgb(0, 0, 0) 1px, rgba(0, 0, 0, 0) 1px)",
        "background-size": "25px 25px",
      },
    });

    const [band] = paths(tree(root(), grid));

    expect(paths(tree(root(), grid))).toHaveLength(1);
    expect(band.contours).toHaveLength(8);
    expect(band.paint).toEqual({ kind: PaintKind.Solid, color: [0, 0, 0, 1] });
  });

  it("paints a transformed box from a whole-pixel offset, as the browser does", () => {
    const turned = el({
      parent: 0,
      at: [100.4, 99.6],
      size: [40, 20],
      style: {
        "background-color": "rgb(0, 0, 0)",
        transform: "matrix(1, 0, 0, 1, 0, 0)",
      },
    });

    expect(near(bounds(paths(tree(root(), turned))[0]))).toEqual({
      left: 100,
      top: 100,
      right: 140,
      bottom: 120,
    });
  });

  it("turns a box about its transform origin", () => {
    const turned = el({
      parent: 0,
      at: [100, 100],
      size: [40, 20],
      style: {
        "background-color": "rgb(0, 0, 0)",
        transform: "matrix(0, 1, -1, 0, 0, 0)",
        "transform-origin": "20px 10px",
      },
    });

    expect(near(bounds(paths(tree(root(), turned))[0]))).toEqual({
      left: 110,
      top: 90,
      right: 130,
      bottom: 130,
    });
  });

  it("fills an svg polygon in the svg viewport, offset by where the svg sits", () => {
    const svg = el({
      parent: 0,
      tag: "svg",
      svg: true,
      at: [50, 0],
      size: [200, 200],
      attrs: { width: "200", height: "200" },
    });
    const polygon = el({
      parent: 1,
      tag: "polygon",
      svg: true,
      at: null,
      attrs: { points: "0,0 10,0 10,10" },
      style: {
        fill: "rgb(0, 0, 255)",
        "fill-rule": "evenodd",
        "fill-opacity": "0.5",
      },
    });

    const [shape] = paths(tree(root(), svg, polygon));

    expect(near(bounds(shape))).toEqual({
      left: 50,
      top: 0,
      right: 60,
      bottom: 10,
    });
    expect(shape.rule).toBe(FillRule.EvenOdd);
    expect(shape.opacity).toBeCloseTo(0.5);
  });

  it("names text as not drawn and still paints the box behind it", () => {
    const label = el({
      parent: 0,
      size: [100, 40],
      text: "hello",
      attrs: { class: "title" },
      style: { "background-color": "rgb(0, 0, 0)" },
    });

    const read = readTree(tree(root(), label));

    expect(read.drawn).toHaveLength(1);
    expect(read.gaps).toEqual([
      { element: "div.title", reason: DomGap.Text, count: 1 },
    ]);
  });

  it("rounds a square with a 50% radius into a circle", () => {
    const dot = el({
      parent: 0,
      at: [0, 0],
      size: [100, 100],
      style: {
        "background-color": "rgb(0, 0, 0)",
        "border-top-left-radius": "50%",
        "border-top-right-radius": "50%",
        "border-bottom-right-radius": "50%",
        "border-bottom-left-radius": "50%",
      },
    });

    const [circle] = paths(tree(root(), dot));
    const [x, y] = apply2d(circle.matrix, [
      circle.contours[0][0],
      circle.contours[0][1],
    ]);

    expect(circle.contours[0].length).toBeGreaterThan(16);
    expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(50, 1);
  });

  it("draws a solid border as a ring around the padding box", () => {
    const solid = {
      "border-top-width": "2px",
      "border-top-style": "solid",
      "border-top-color": "rgb(0, 0, 0)",
    };
    const ruled = el({
      parent: 0,
      at: [10, 10],
      size: [100, 30],
      style: solid,
    });

    const [ring] = paths(tree(root(), ruled));

    expect(ring.rule).toBe(FillRule.EvenOdd);
    expect(ring.contours).toHaveLength(2);
    expect(near(bounds(ring))).toEqual({
      left: 10,
      top: 10,
      right: 110,
      bottom: 40,
    });
  });

  it("tiles a sized soft gradient across the box", () => {
    const grid = el({
      parent: 0,
      size: [100, 50],
      style: {
        "background-image":
          "linear-gradient(90deg, rgb(0, 0, 0), rgba(0, 0, 0, 0))",
        "background-size": "25px 25px",
      },
    });

    const tiles = paths(tree(root(), grid));

    expect(tiles).toHaveLength(8);
    expect(tiles[1].paint).toMatchObject({
      kind: PaintKind.Linear,
      from: [25, 12.5],
      to: [50, 12.5],
      stops: [{ at: 0 }, { at: 1 }],
    });
  });

  it("spans an unsized gradient over the whole box along its angle", () => {
    const wash = el({
      parent: 0,
      size: [100, 50],
      style: {
        "background-image": "linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))",
      },
    });

    expect(paths(tree(root(), wash))[0].paint).toMatchObject({
      kind: PaintKind.Linear,
      from: [50, expect.closeTo(0)],
      to: [50, expect.closeTo(50)],
      stops: [{ at: 0 }, { at: 1 }],
    });
  });

  it("filters a subtree whose filter mixes its items together as one group", () => {
    const blurred = el({
      parent: 0,
      size: [50, 50],
      attrs: { class: "soft" },
      style: {
        filter: "drop-shadow(rgb(0, 0, 0) 2px 2px 4px)",
        "background-color": "rgb(0, 0, 0)",
      },
    });
    const child = el({
      parent: 1,
      size: [10, 10],
      style: { "background-color": "rgb(0, 0, 0)" },
    });

    const read = readTree(tree(root(), blurred, child));

    expect(read.gaps).toEqual([]);
    expect(read.drawn).toMatchObject([
      {
        kind: DrawnKind.Group,
        items: [{ kind: DrawnKind.Path }, { kind: DrawnKind.Path }],
        filters: [{ kind: FilterKind.Css }],
      },
    ]);
  });

  it("composites a canvas as a layer over its css box", () => {
    const canvas = el({
      parent: 0,
      tag: "canvas",
      at: [10, 0],
      size: [320, 180],
      layer: 0,
      style: { opacity: "0.5" },
    });

    expect(readTree(tree(root(), canvas)).drawn).toEqual([
      {
        kind: DrawnKind.Layer,
        layer: 0,
        width: 320,
        height: 180,
        opacity: 0.5,
        matrix: [1, 0, 0, 1, 10, 0],
      },
    ]);
  });

  it("clips what spills out of a rounded box to its rounded outline", () => {
    const clip = el({
      parent: 0,
      size: [50, 50],
      style: { overflow: "hidden", "border-top-left-radius": "8px" },
    });
    const inside = el({
      parent: 1,
      size: [10, 10],
      style: { "background-color": "rgb(0, 0, 0)" },
    });
    const outside = el({
      parent: 1,
      at: [45, 0],
      size: [10, 10],
      style: { "background-color": "rgb(0, 0, 0)" },
    });

    const read = readTree(tree(root(), clip, inside, outside));
    const cover = read.drawn[0].masks?.[0].cover as { contours: number[][] };

    expect(readTree(tree(root(), clip, inside)).drawn).toHaveLength(1);
    expect(read.gaps).toEqual([]);
    expect(cover.contours[0].length).toBeGreaterThan(8);
  });

  it("multiplies opacity into a single painted leaf", () => {
    const faded = (n: number) => [
      el({ parent: 0, size: [50, 50], style: { opacity: "0.5" } }),
      ...Array.from({ length: n }, () =>
        el({
          parent: 1,
          size: [10, 10],
          style: { "background-color": "rgb(0, 0, 0)" },
        }),
      ),
    ];

    expect(paths(tree(root(), ...faded(1)))[0].opacity).toBeCloseTo(0.5);
  });

  it("fades a group whose items do not overlap item by item, which looks the same", () => {
    const faded = el({ parent: 0, size: [50, 50], style: { opacity: "0.5" } });
    const square = (x: number) =>
      el({
        parent: 1,
        at: [x, 0],
        size: [10, 10],
        style: { "background-color": "rgb(0, 0, 0)" },
      });

    const read = readTree(tree(root(), faded, square(0), square(20)));

    expect(read.gaps).toEqual([]);
    expect(read.drawn.map((d) => d.opacity)).toEqual([0.5, 0.5]);
  });

  it("fades overlapping items together, as one group", () => {
    const faded = el({ parent: 0, size: [50, 50], style: { opacity: "0.5" } });
    const square = () =>
      el({
        parent: 1,
        at: [0, 0],
        size: [10, 10],
        style: { "background-color": "rgb(0, 0, 0)" },
      });

    const read = readTree(tree(root(), faded, square(), square()));

    expect(read.gaps).toEqual([]);
    expect(read.drawn).toHaveLength(1);
    expect(read.drawn[0]).toMatchObject({
      kind: DrawnKind.Group,
      opacity: 0.5,
    });
  });

  it("casts each box shadow under the box, blurred by half its radius", () => {
    const card = el({
      parent: 0,
      at: [10, 10],
      size: [100, 50],
      style: {
        "background-color": "rgb(255, 255, 255)",
        "box-shadow":
          "rgba(0, 0, 0, 0.18) 0px 30px 80px 0px, rgba(0, 0, 0, 0.06) 0px 2px 6px 0px",
      },
    });

    const read = readTree(tree(root(), card));
    const [far, near2, box] = read.drawn as DrawnPath[];

    expect(read.gaps).toEqual([]);
    expect(far.paint).toEqual({
      kind: PaintKind.Solid,
      color: [0, 0, 0, 0.06],
    });
    expect(far.filters).toEqual([
      { kind: FilterKind.Css, fns: [{ name: "blur", args: ["3px"] }] },
    ]);
    expect(near(bounds(near2))).toEqual({
      left: 10,
      top: 40,
      right: 110,
      bottom: 90,
    });
    expect(box.paint).toEqual({ kind: PaintKind.Solid, color: [1, 1, 1, 1] });
  });

  it("stacks positioned siblings by z-index, negative ones under the flow", () => {
    const box = (z: string, color: string) =>
      el({
        parent: 0,
        size: [10, 10],
        style: {
          position: "absolute",
          "z-index": z,
          "background-color": color,
        },
      });
    const flow = el({
      parent: 0,
      size: [10, 10],
      style: { "background-color": "rgb(0, 0, 255)" },
    });

    const read = readTree(
      tree(
        root(),
        box("2", "rgb(255, 0, 0)"),
        box("1", "rgb(0, 255, 0)"),
        flow,
        box("-1", "rgb(0, 0, 0)"),
      ),
    );

    expect(read.gaps).toEqual([]);
    expect(
      (read.drawn as DrawnPath[]).map((d) =>
        d.paint.kind === PaintKind.Solid ? d.paint.color.join() : "",
      ),
    ).toEqual(["0,0,0,1", "0,0,1,1", "0,1,0,1", "1,0,0,1"]);
  });

  it("clips a box to an inset() clip path", () => {
    const wiped = el({
      parent: 0,
      at: [10, 10],
      size: [100, 40],
      style: {
        "background-color": "rgb(0, 0, 0)",
        "clip-path": "inset(0px 25% 10px 0px)",
      },
    });

    const [item] = readTree(tree(root(), wiped)).drawn;

    expect(item.masks?.[0].cover).toEqual({
      kind: CoverKind.Path,
      contours: [[0, 0, 75, 0, 75, 30, 0, 30]],
      matrix: [1, 0, 0, 1, 10, 10],
    });
  });

  it("strokes a polyline open, without the segment back to its start", () => {
    const svg = el({ parent: 0, tag: "svg", svg: true, size: [100, 100] });
    const chevron = el({
      parent: 1,
      tag: "polyline",
      svg: true,
      at: null,
      attrs: { points: "0,0 10,0 10,10" },
      style: { fill: "none", stroke: "rgb(0, 0, 0)", "stroke-width": "2px" },
    });
    const [stroke] = readTree(tree(root(), svg, chevron)).drawn as DrawnPath[];
    const winding = (x: number, y: number) =>
      stroke.contours.reduce((w, c) => {
        let turns = 0;
        for (let i = 0; i < c.length; i += 2) {
          const [x0, y0, x1, y1] = [c[i], c[i + 1], c[(i + 2) % c.length], c[(i + 3) % c.length]];
          if (y0 <= y !== y1 <= y && x < x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)) {
            turns += y1 > y0 ? 1 : -1;
          }
        }
        return w + turns;
      }, 0);

    expect(winding(5, 0)).not.toBe(0);
    expect(winding(5, 5)).toBe(0);
  });

  it("draws an svg stroke with a dash pattern of any length", () => {
    const svg = el({ parent: 0, tag: "svg", svg: true, size: [100, 100] });
    const rect = el({
      parent: 1,
      tag: "rect",
      svg: true,
      at: null,
      attrs: { x: "10", y: "10", width: "20", height: "20" },
      style: {
        fill: "rgb(0, 0, 0)",
        stroke: "rgb(255, 255, 255)",
        "stroke-width": "2px",
        "stroke-dasharray": "1 2 3",
      },
    });

    const read = readTree(tree(root(), svg, rect));

    expect(read.drawn).toHaveLength(2);
    expect(read.gaps).toEqual([]);
  });

  it("skips a transparent svg fill, the hit area of an editable part", () => {
    const svg = el({ parent: 0, tag: "svg", svg: true, size: [100, 100] });
    const hit = el({
      parent: 1,
      tag: "rect",
      svg: true,
      at: null,
      attrs: { width: "20", height: "20" },
      style: { fill: "rgba(0, 0, 0, 0)" },
    });

    expect(readTree(tree(root(), svg, hit))).toEqual({ drawn: [], gaps: [] });
  });

  it("names a fill that points at an svg paint server", () => {
    const svg = el({ parent: 0, tag: "svg", svg: true, size: [100, 100] });
    const rects = [1, 2].map(() =>
      el({
        parent: 1,
        tag: "rect",
        svg: true,
        at: null,
        attrs: { width: "20", height: "20" },
        style: { fill: 'url("#sky")' },
      }),
    );

    expect(readTree(tree(root(), svg, ...rects)).gaps).toEqual([
      { element: "rect", reason: DomGap.Paint, count: 2 },
    ]);
  });

  it("paints in-flow boxes before positioned siblings, as css stacks them", () => {
    const lifted = el({
      parent: 0,
      size: [10, 10],
      style: { position: "absolute", "background-color": "rgb(255, 0, 0)" },
    });
    const flow = el({
      parent: 0,
      size: [10, 10],
      style: { position: "static", "background-color": "rgb(0, 0, 255)" },
    });

    expect(paths(tree(root(), lifted, flow)).map((p) => p.paint)).toEqual([
      { kind: PaintKind.Solid, color: [0, 0, 1, 1] },
      { kind: PaintKind.Solid, color: [1, 0, 0, 1] },
    ]);
  });

  it("names media it cannot draw", () => {
    expect(
      readTree(
        tree(root(), el({ parent: 0, tag: "img", size: [10, 10] })),
      ).gaps.map((g) => g.reason),
    ).toEqual([DomGap.Media]);
  });
  describe("text", () => {
    const typeset = (missing: string[] = []) => ({
      fonts: boxBook(new Set(missing)),
      smoothing: Smoothing.Plain,
    });
    const line = (chars: string[], xs: number[], top = 30) => ({
      chars,
      xs,
      top,
      height: 10,
    });
    const label = (part: Partial<RawNode> = {}) =>
      el({
        parent: 0,
        at: [10, 10],
        size: [100, 40],
        text: "ab",
        lines: [line(["a", "b"], [20, 26])],
        style: {
          color: "rgb(255, 0, 0)",
          "font-family": '"Inter Tight", system-ui',
          "font-size": "10px",
          "font-weight": "600",
        },
        ...part,
      });

    it("inks svg text with its fill", () => {
      const svg = el({ parent: 0, tag: "svg", svg: true, size: [100, 40] });
      const text = el({
        parent: 1,
        tag: "text",
        svg: true,
        at: null,
        text: "ab",
        lines: [line(["a", "b"], [20, 26])],
        style: { fill: "rgb(0, 0, 255)", "font-family": '"Inter Tight", system-ui', "font-size": "10px", "font-weight": "600" },
      });
      const read = readTree(tree(root(), svg, text), typeset());

      expect(read.gaps).toEqual([]);
      expect((read.drawn as DrawnPath[]).map((g) => g.paint)).toEqual([
        { kind: PaintKind.Solid, color: [0, 0, 1, 1] },
        { kind: PaintKind.Solid, color: [0, 0, 1, 1] },
      ]);
    });

    it("draws every glyph where the browser placed it, on the line baseline", () => {
      const read = readTree(tree(root(), label()), typeset());
      const glyphs = read.drawn as DrawnPath[];

      expect(read.gaps).toEqual([]);
      expect(glyphs.map((g) => near(bounds(g)))).toEqual([
        { left: 30, top: 41, right: 35, bottom: 48 },
        { left: 36, top: 41, right: 41, bottom: 48 },
      ]);
      expect(glyphs[0].paint).toEqual({
        kind: PaintKind.Solid,
        color: [1, 0, 0, 1],
      });
    });

    it("does not darken stems the page asked to render without", () => {
      const dilated = { fonts: boxBook(), smoothing: Smoothing.Dilated };
      const plain = readTree(
        tree(
          root(),
          label({
            style: {
              ...label().style,
              "-webkit-font-smoothing": "antialiased",
            },
          }),
        ),
        dilated,
      );

      expect(near(bounds(plain.drawn[0] as DrawnPath))).toEqual({
        left: 30,
        top: 41,
        right: 35,
        bottom: 48,
      });
    });

    it("sits upright glyphs on whole pixel rows and quarter-pixel columns, as the browser does", () => {
      const read = readTree(
        tree(
          root(),
          label({
            lines: [{ chars: ["a"], xs: [20.4], top: 30.3, height: 10 }],
          }),
        ),
        typeset(),
      );

      expect(near(bounds(read.drawn[0] as DrawnPath))).toEqual({
        left: 30.5,
        top: 41,
        right: 35.5,
        bottom: 48,
      });
    });

    it("draws the case the browser shows, not the case typed", () => {
      const read = readTree(
        tree(
          root(),
          label({ style: { ...label().style, "text-transform": "uppercase" } }),
        ),
        typeset(["a", "b"]),
      );

      expect(read.drawn).toHaveLength(2);
      expect(read.gaps).toEqual([]);
    });

    it("names a glyph no loaded font covers", () => {
      const read = readTree(tree(root(), label()), typeset(["b"]));

      expect(read.drawn).toHaveLength(1);
      expect(read.gaps.map((g) => g.reason)).toEqual([DomGap.Font]);
    });

    it("draws text set in a font the page never loaded from the raster the browser made of it, where the browser put it", () => {
      const read = readTree(
        tree(
          root(),
          label({
            raster: { layer: 3, width: 120, height: 60, at: [-15.5, -16.25] },
          }),
        ),
        typeset(["a", "b"]),
      );

      expect(read.gaps).toEqual([]);
      expect(read.drawn).toEqual([
        {
          kind: DrawnKind.Layer,
          layer: 3,
          width: 120,
          height: 60,
          opacity: 1,
          matrix: [1, 0, 0, 1, -5.5, -6.25],
        },
      ]);
    });
  });
  describe("svg groups", () => {
    const svg = () =>
      el({ parent: 0, tag: "svg", svg: true, at: [0, 0], size: [400, 300] });
    const g = (style: RawNode["style"] = {}) =>
      el({ parent: 1, tag: "g", svg: true, at: null, style });
    const rect = (parent: number, style: RawNode["style"] = {}) =>
      el({
        parent,
        tag: "rect",
        svg: true,
        at: null,
        attrs: { width: "400", height: "300" },
        style: { fill: "rgb(0, 0, 0)", ...style },
      });
    const blur = {
      tag: "filter",
      attrs: { id: "soft" },
      children: [{ tag: "feGaussianBlur", attrs: { stdDeviation: "1.2" } }],
    };
    const noise = {
      tag: "filter",
      attrs: { id: "noise" },
      children: [{ tag: "feTurbulence", attrs: { baseFrequency: "0.9" } }],
    };
    const clip = {
      tag: "clipPath",
      attrs: { id: "tiles" },
      children: [
        { tag: "rect", attrs: { x: "10", y: "20", width: "30", height: "40" } },
      ],
    };
    const goo = {
      tag: "filter",
      attrs: { id: "goo" },
      children: [
        { tag: "feGaussianBlur", attrs: { stdDeviation: "8" } },
        { tag: "feColorMatrix", attrs: { values: "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -9" } },
      ],
    };
    const withDefs = (t: RawTree): RawTree => ({
      ...t,
      defs: { soft: blur, noise, tiles: clip, goo },
    });

    it("clips every item of a group to its clip path", () => {
      const read = readTree(
        withDefs(
          tree(
            root(),
            svg(),
            g({ "clip-path": 'url("#tiles")' }),
            rect(2),
            rect(2),
          ),
        ),
      );

      expect(read.gaps).toEqual([]);
      expect(read.drawn).toHaveLength(2);
      for (const item of read.drawn) {
        expect(item.masks).toEqual([
          {
            mode: MaskMode.Intersect,
            invert: false,
            level: 1,
            feather: 0,
            cover: {
              kind: CoverKind.Path,
              contours: [[10, 20, 40, 20, 40, 60, 10, 60]],
              matrix: [1, 0, 0, 1, 0, 0],
            },
          },
        ]);
      }
    });

    it("filters and blends a single shape with the filter its attribute names", () => {
      const [item] = readTree(
        withDefs(
          tree(
            root(),
            svg(),
            rect(1, {
              filter: 'url("#noise")',
              "mix-blend-mode": "multiply",
              opacity: "0.35",
            }),
          ),
        ),
      ).drawn;

      expect(item.filters?.map((f) => f.kind)).toEqual([FilterKind.Svg]);
      expect(item.blend).toBe(BlendMode.Multiply);
      expect(item.opacity).toBeCloseTo(0.35);
    });

    it("lays noise over the filter region, a tenth of the shape beyond each side", () => {
      const [item] = readTree(
        withDefs(tree(root(), svg(), rect(1, { filter: 'url("#noise")' }))),
      ).drawn;
      const filter = item.filters?.[0];
      const turbulence =
        filter?.kind === FilterKind.Svg ? filter.nodes[0].children?.[0] : null;

      expect(turbulence?.attrs).toMatchObject({
        x: -40,
        y: -30,
        width: 480,
        height: 360,
      });
    });

    it("carries where the filtered element starts, so primitive subregions land in the canvas", () => {
      const moved = el({
        parent: 0,
        tag: "svg",
        svg: true,
        at: [50, 20],
        size: [400, 300],
      });
      const [item] = readTree(
        withDefs(tree(root(), moved, rect(1, { filter: 'url("#soft")' }))),
      ).drawn;

      expect(item.origin).toEqual([50, 20]);
    });

    it("blurs each shape of a blurred group", () => {
      const read = readTree(
        withDefs(
          tree(root(), svg(), g({ filter: 'url("#soft")' }), rect(2), rect(2)),
        ),
      );

      expect(read.gaps).toEqual([]);
      expect(read.drawn.map((d) => d.filters)).toEqual([
        [{ kind: FilterKind.Svg, nodes: [blur] }],
        [{ kind: FilterKind.Svg, nodes: [blur] }],
      ]);
    });

    it("filters a gooey group as one, so its shapes melt into each other", () => {
      const read = readTree(
        withDefs(
          tree(root(), svg(), g({ filter: 'url("#goo")' }), rect(2), rect(2)),
        ),
      );

      expect(read.drawn).toMatchObject([
        { kind: DrawnKind.Group, filters: [{ kind: FilterKind.Svg }] },
      ]);
    });

    it("filters a group whose filter mixes its shapes together as one", () => {
      const read = readTree(
        withDefs(
          tree(root(), svg(), g({ filter: 'url("#noise")' }), rect(2), rect(2)),
        ),
      );

      expect(read.gaps).toEqual([]);
      expect(read.drawn).toMatchObject([
        { kind: DrawnKind.Group, filters: [{ kind: FilterKind.Svg }] },
      ]);
    });

    it("blends a group as one", () => {
      const read = readTree(
        withDefs(
          tree(
            root(),
            svg(),
            g({ "mix-blend-mode": "multiply" }),
            rect(2),
            rect(2),
          ),
        ),
      );

      expect(read.gaps).toEqual([]);
      expect(read.drawn).toMatchObject([
        { kind: DrawnKind.Group, blend: BlendMode.Multiply },
      ]);
    });
  });
  describe("svg paint", () => {
    const svg = (style: RawNode["style"] = {}) =>
      el({
        parent: 0,
        tag: "svg",
        svg: true,
        at: [0, 0],
        size: [400, 300],
        style,
      });
    const shape = (
      tag: string,
      attrs: RawNode["attrs"],
      style: RawNode["style"],
    ) => el({ parent: 1, tag, svg: true, at: null, attrs, style });
    const sky: SvgNode = {
      tag: "linearGradient",
      attrs: { id: "sky", x1: "0", y1: "0", x2: "0.3", y2: "1" },
      children: [
        { tag: "stop", attrs: { offset: "0", "stop-color": "#ffffff" } },
        {
          tag: "stop",
          attrs: {
            offset: "1",
            "stop-color": "#000000",
            "stop-opacity": "0.5",
          },
        },
      ],
    };
    const mesh: SvgNode = {
      tag: "pattern",
      attrs: {
        id: "mesh",
        width: "5",
        height: "5",
        patternUnits: "userSpaceOnUse",
      },
      children: [
        {
          tag: "rect",
          attrs: { width: "5", height: "1", fill: "#000", opacity: "0.12" },
        },
      ],
    };
    const read = (...nodes: RawNode[]) =>
      readTree({ ...tree(root(), ...nodes), defs: { sky, mesh } });

    it("fills with a linear gradient laid over the shape bounding box", () => {
      const { drawn, gaps } = read(
        svg(),
        shape(
          "rect",
          { x: "10", y: "20", width: "100", height: "50" },
          { fill: 'url("#sky")' },
        ),
      );
      const [item] = drawn as DrawnPath[];

      expect(gaps).toEqual([]);
      expect(item.paint).toEqual({
        kind: PaintKind.Linear,
        from: [0, 0],
        to: [0.3, 1],
        stops: [
          { at: 0, color: [1, 1, 1, 1] },
          { at: 1, color: [0, 0, 0, 0.5] },
        ],
      });
      expect(near(bounds(item))).toEqual({
        left: 10,
        top: 20,
        right: 110,
        bottom: 70,
      });
    });

    it("fills with a user-space pattern of rects, one run per row", () => {
      const { drawn, gaps } = read(
        svg(),
        shape("rect", { width: "20", height: "10" }, { fill: 'url("#mesh")' }),
      );
      const [item] = drawn as DrawnPath[];

      expect(gaps).toEqual([]);
      expect(item.contours).toEqual([
        [0, 0, 20, 0, 20, 1, 0, 1],
        [0, 5, 20, 5, 20, 6, 0, 6],
      ]);
      expect(item.paint).toEqual({
        kind: PaintKind.Solid,
        color: [0, 0, 0, 1],
      });
      expect(item.opacity).toBeCloseTo(0.12);
    });

    it("strokes a shape over its fill", () => {
      const { drawn, gaps } = read(
        svg(),
        shape(
          "circle",
          { cx: "50", cy: "50", r: "10" },
          {
            fill: "rgb(0, 0, 0)",
            stroke: "rgb(255, 255, 255)",
            "stroke-width": "4",
          },
        ),
      );
      const [, ring] = drawn as DrawnPath[];

      expect(gaps).toEqual([]);
      expect(ring.rule).toBe(FillRule.Union);
      expect(ring.paint).toEqual({
        kind: PaintKind.Solid,
        color: [1, 1, 1, 1],
      });
      expect(near(bounds(ring))).toEqual({
        left: 38,
        top: 38,
        right: 62,
        bottom: 62,
      });
    });

    it("clips what spills out of a box that hides its overflow", () => {
      const { drawn, gaps } = read(
        svg({ overflow: "hidden" }),
        shape(
          "rect",
          { x: "-10", width: "50", height: "50" },
          { fill: "rgb(0, 0, 0)" },
        ),
      );

      expect(gaps).toEqual([]);
      expect(drawn[0].masks?.[0].cover).toEqual({
        kind: CoverKind.Path,
        contours: [[0, 0, 400, 0, 400, 300, 0, 300]],
        matrix: [1, 0, 0, 1, 0, 0],
      });
    });
  });
});

describe("readTree, CSS a motion template draws with", () => {
  const box = (style: RawNode["style"], part: Partial<RawNode> = {}) =>
    el({ parent: 0, at: [0, 0], size: [200, 100], style, ...part });
  const world = (item: DrawnPath, p: [number, number]) =>
    apply2d(item.matrix, p).map((v) => Math.round(v * 100) / 100);

  it("fills a box with an elliptical radial gradient sized and placed in percent", () => {
    const wash = box({
      "background-image":
        "radial-gradient(130% 110% at 18% 8%, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)",
    });

    const read = readTree(tree(root(), wash));
    const [item] = read.drawn as DrawnPath[];

    expect(read.gaps).toEqual([]);
    expect(near(bounds(item))).toEqual({
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
    });
    expect(item.paint).toMatchObject({
      kind: PaintKind.Radial,
      radius: 260,
      stops: [{ at: 0 }, { at: 1 }],
    });
    expect(
      world(item, (item.paint as { center: [number, number] }).center),
    ).toEqual([36, 8]);
    expect(item.matrix[3] / item.matrix[0]).toBeCloseTo(110 / 260);
  });

  it("reaches the farthest corner with a default radial gradient", () => {
    const wash = box({
      "background-image":
        "radial-gradient(rgb(255, 255, 255), rgba(0, 0, 0, 0))",
    });

    const [item] = paths(tree(root(), wash));

    expect((item.paint as { radius: number }).radius).toBeCloseTo(
      100 * Math.SQRT2,
    );
    expect(
      world(item, (item.paint as { center: [number, number] }).center),
    ).toEqual([100, 50]);
  });

  it("stacks two radial layers, the first one on top", () => {
    const light = box({
      "background-image":
        "radial-gradient(circle at 0% 0%, rgb(255, 0, 0) 0%, rgba(0, 0, 0, 0) 50%), radial-gradient(circle 40px at 50% 50%, rgb(0, 0, 255), rgba(0, 0, 0, 0))",
    });

    const drawn = paths(tree(root(), light));

    expect(drawn.map((d) => (d.paint as { radius: number }).radius)).toEqual([
      40,
      expect.closeTo(Math.hypot(200, 100)),
    ]);
  });

  it("draws a box under a 3D transform with its corners where the browser projects them", () => {
    const tilt =
      "matrix3d(0.9, 0.05, 0, 0.0004, -0.04, 0.95, 0, 0.0002, 0, 0, 1, 0, 30, 20, 0, 1)";
    const screen = box({
      "background-color": "rgb(255, 255, 255)",
      transform: tilt,
      "transform-origin": "0px 0px",
    });

    const read = readTree(tree(root(), screen));
    const [item] = read.drawn as DrawnPath[];
    const projected = ([x, y]: [number, number]) => {
      const w = 0.0004 * x + 0.0002 * y + 1;
      return [(0.9 * x - 0.04 * y + 30) / w, (0.05 * x + 0.95 * y + 20) / w];
    };
    const corners: [number, number][] = [
      [0, 0],
      [200, 0],
      [200, 100],
      [0, 100],
    ];
    const drawnPoints = Array.from(
      { length: item.contours[0].length / 2 },
      (_, i) =>
        world(item, [item.contours[0][2 * i], item.contours[0][2 * i + 1]]),
    );
    const miss = (c: [number, number]) =>
      Math.min(
        ...drawnPoints.map((p) =>
          Math.hypot(p[0] - projected(c)[0], p[1] - projected(c)[1]),
        ),
      );

    expect(read.gaps).toEqual([]);
    expect(corners.map(miss).every((d) => d < 0.05)).toBe(true);
  });

  it("projects a bitmap under a 3D transform in tiles, each placed where the browser puts it", () => {
    const tilt =
      "matrix3d(0.9, 0.05, 0, 0.0004, -0.04, 0.95, 0, 0.0002, 0, 0, 1, 0, 30, 20, 0, 1)";
    const screen = box({ transform: tilt, "transform-origin": "0px 0px" }, { tag: "canvas", layer: 0 });
    const projected = ([x, y]: [number, number]): [number, number] => {
      const w = 0.0004 * x + 0.0002 * y + 1;
      return [(0.9 * x - 0.04 * y + 30) / w, (0.05 * x + 0.95 * y + 20) / w];
    };
    const inside = (quad: number[], [x, y]: [number, number]) =>
      [0, 2, 4, 6].every((i) => {
        const [x0, y0, x1, y1] = [quad[i], quad[i + 1], quad[(i + 2) % 8], quad[(i + 3) % 8]];
        return (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0) >= -1;
      });

    const read = readTree(tree(root(), screen));
    const tiles = read.drawn.filter((d) => d.kind === DrawnKind.Layer);
    const placedAt = (p: [number, number]) => {
      const tile = tiles.find((t) => t.masks?.[0].cover.kind === CoverKind.Path && inside(t.masks[0].cover.contours[0], projected(p)))!;
      return apply2d(tile.matrix, p);
    };

    expect(read.gaps).toEqual([]);
    expect(tiles.length).toBeGreaterThan(1);
    for (const p of [[100, 50], [37, 81], [180, 12]] as [number, number][]) {
      expect(Math.hypot(placedAt(p)[0] - projected(p)[0], placedAt(p)[1] - projected(p)[1])).toBeLessThan(0.5);
    }
  });

  it("keeps a bitmap whole when its box fit already lands within half a pixel", () => {
    const faint = "matrix3d(1, 0, 0, 0.000001, 0, 1, 0, 0, 0, 0, 1, 0, 30, 20, 0, 1)";
    const screen = box({ transform: faint, "transform-origin": "0px 0px" }, { tag: "canvas", layer: 0 });

    expect(readTree(tree(root(), screen)).drawn).toHaveLength(1);
  });

  it("projects a child through the perspective its parent sets", () => {
    const stage = el({
      parent: 0,
      at: [0, 0],
      size: [400, 300],
      style: { perspective: "400px", "perspective-origin": "200px 150px" },
    });
    const card = el({
      parent: 1,
      at: [100, 100],
      size: [200, 100],
      style: {
        "background-color": "rgb(0, 0, 0)",
        transform: "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 200, 1)",
        "transform-origin": "100px 50px",
      },
    });

    const [item] = paths(tree(root(), stage, card));

    expect(near(bounds(item))).toEqual({
      left: 0,
      top: 50,
      right: 400,
      bottom: 250,
    });
  });

  it("draws a url background from the bitmap the page rasterised for it", () => {
    const grain = box(
      {
        "background-image": 'url("data:image/svg+xml;utf8,<svg/>")',
        "background-size": "180px 180px",
      },
      { layer: 3 },
    );

    const read = readTree(tree(root(), grain));

    expect(read.gaps).toEqual([]);
    expect(read.drawn).toMatchObject([
      { kind: DrawnKind.Layer, layer: 3, width: 200, height: 100 },
    ]);
  });

  it("paints a gradient layer over the url bitmap under it", () => {
    const both = box(
      {
        "background-image":
          'linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255)), url("a.png")',
      },
      { layer: 0 },
    );

    expect(readTree(tree(root(), both)).drawn.map((d) => d.kind)).toEqual([
      DrawnKind.Layer,
      DrawnKind.Path,
    ]);
  });

  it("still names a url background the page could not rasterise", () => {
    expect(
      readTree(tree(root(), box({ "background-image": 'url("a.png")' }))).gaps,
    ).toMatchObject([{ reason: DomGap.Background }]);
  });

  it("draws an image from its bitmap", () => {
    const image = box({}, { tag: "img", layer: 1 });

    expect(readTree(tree(root(), image)).drawn).toMatchObject([
      { kind: DrawnKind.Layer, layer: 1, width: 200, height: 100 },
    ]);
  });

  it("draws an svg image from its bitmap, at its own x and y", () => {
    const image = el({
      parent: 0,
      tag: "image",
      svg: true,
      layer: 1,
      size: [30, 20],
      attrs: { x: "5", y: "7", width: "30", height: "20" },
    });

    const read = readTree(tree(root(), image));

    expect(read.gaps).toEqual([]);
    expect(read.drawn).toMatchObject([
      { kind: DrawnKind.Layer, layer: 1, width: 30, height: 20, matrix: [1, 0, 0, 1, 5, 7] },
    ]);
  });

  it("reads color-mix() stops and shadows in the srgb form the browser computes", () => {
    const mixed = box({
      "background-image":
        "radial-gradient(color(srgb 1 0 0 / 0.38) 0%, rgba(0, 0, 0, 0) 72%)",
      "box-shadow": "color(srgb 0 0 1 / 0.45) 0px 4px 8px 0px",
    });

    expect(readTree(tree(root(), mixed)).gaps).toEqual([]);
  });

  it("fades the edges a gradient mask-image fades, one ramp per edge", () => {
    const fade =
      "linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 10%, rgb(0, 0, 0) 90%, rgba(0, 0, 0, 0) 100%)";
    const rows = box({
      "mask-image": fade,
      "background-color": "rgb(255, 0, 0)",
    });

    const read = readTree(tree(root(), rows));
    const ramps = (read.drawn[0].masks ?? []).map(
      (m) =>
        m.cover as {
          kind: CoverKind;
          matrix: [number, number, number, number, number, number];
        },
    );

    expect(read.gaps).toEqual([]);
    expect(ramps.map((r) => r.kind)).toEqual([CoverKind.Ramp, CoverKind.Ramp]);
    expect(
      ramps.map((r) =>
        [apply2d(r.matrix, [0, 0])[0], apply2d(r.matrix, [1, 0])[0]].map(
          Math.round,
        ),
      ),
    ).toEqual([
      [20, 0],
      [180, 200],
    ]);
  });

  it("draws an svg the probe rasterised as its bitmap, and nothing inside it", () => {
    const svg = el({ parent: 0, tag: "svg", svg: true, at: [10, 20], size: [50, 40], layer: 2 });
    const masked = el({ parent: 1, tag: "rect", svg: true, at: null, attrs: { width: "50", height: "40" }, style: { fill: 'url("#dots")' } });

    expect(readTree(tree(root(), svg, masked))).toEqual({
      drawn: [{ kind: DrawnKind.Layer, layer: 2, width: 50, height: 40, opacity: 1, matrix: [1, 0, 0, 1, 10, 20] }],
      gaps: [],
    });
  });

  it("cuts out the band a hard-stopped mask-image hides", () => {
    const stencil = box({
      "mask-image":
        "linear-gradient(90deg, rgb(0, 0, 0) 0%, rgb(0, 0, 0) 40%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0) 60%, rgb(0, 0, 0) 60%)",
      "background-color": "rgb(255, 0, 0)",
    });

    const read = readTree(tree(root(), stencil));
    const [layer] = read.drawn[0].masks ?? [];
    const xs = layer.cover.kind === CoverKind.Path ? layer.cover.contours.flat().filter((_, i) => i % 2 === 0).map((x) => apply2d(layer.cover.matrix, [x, 0])[0]) : [];

    expect(read.gaps).toEqual([]);
    expect(layer).toMatchObject({ invert: true, cover: { kind: CoverKind.Path, contours: [expect.any(Array)] } });
    expect([Math.min(...xs), Math.max(...xs)].map(Math.round)).toEqual([80, 120]);
  });

  it("still refuses a mask-image it cannot split into edge fades", () => {
    const striped = box({
      "mask-image":
        "linear-gradient(rgb(0, 0, 0), rgba(0, 0, 0, 0.5), rgb(0, 0, 0))",
      "background-color": "rgb(255, 0, 0)",
    });

    expect(readTree(tree(root(), striped)).gaps).toMatchObject([
      { reason: DomGap.Mask },
    ]);
  });

  it("rounds a box with percent corners into elliptical ones", () => {
    const corners = Object.fromEntries(
      ["top-left", "top-right", "bottom-right", "bottom-left"].map((c) => [
        `border-${c}-radius`,
        "6%",
      ]),
    );
    const card = box({ ...corners, "background-color": "rgb(255, 255, 255)" });

    const read = readTree(tree(root(), card));
    const [item] = read.drawn as DrawnPath[];
    const points = Array.from({ length: item.contours[0].length / 2 }, (_, i) =>
      apply2d(item.matrix, [
        item.contours[0][2 * i],
        item.contours[0][2 * i + 1],
      ]),
    );

    expect(read.gaps).toEqual([]);
    expect(near(bounds(item))).toEqual({
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
    });
    expect(
      points.some(([x, y]) => Math.abs(x - 12) < 0.01 && Math.abs(y) < 0.01),
    ).toBe(true);
    expect(
      points.some(([x, y]) => Math.abs(x) < 0.01 && Math.abs(y - 6) < 0.01),
    ).toBe(true);
  });

  it("strokes an svg line", () => {
    const svg = el({ parent: 0, tag: "svg", svg: true, size: [100, 100] });
    const line = el({
      parent: 1,
      tag: "line",
      svg: true,
      at: null,
      attrs: { x1: "10", y1: "20", x2: "90", y2: "20" } as RawNode["attrs"],
      style: { fill: "none", stroke: "rgb(0, 0, 0)", "stroke-width": "2px" },
    });

    const read = readTree(tree(root(), svg, line));

    expect(read.gaps).toEqual([]);
    expect(near(bounds(read.drawn[0] as DrawnPath))).toMatchObject({
      left: 10,
      top: 19,
      right: 90,
      bottom: 21,
    });
  });

  it("paints a hard inset shadow as a ring inside the box, over its background", () => {
    const bezel = box({
      "background-color": "rgb(255, 255, 255)",
      "box-shadow": "rgba(0, 0, 0, 0.5) 0px 0px 0px 4px inset",
    });

    const read = readTree(tree(root(), bezel));
    const ring = read.drawn[1] as DrawnPath;

    expect(read.gaps).toEqual([]);
    expect(ring.rule).toBe(FillRule.EvenOdd);
    expect(ring.contours).toHaveLength(2);
    expect(near(bounds({ ...ring, contours: [ring.contours[1]] }))).toEqual({
      left: 4,
      top: 4,
      right: 196,
      bottom: 96,
    });
  });

  it("blurs an inset shadow inside the box it shades", () => {
    const glow = box({ "box-shadow": "rgb(0, 0, 255) 0px 3px 6px 0px inset" });

    const [shade] = readTree(tree(root(), glow)).drawn as DrawnPath[];

    expect(shade.filters).toHaveLength(1);
    expect(shade.masks?.[0].cover).toMatchObject({ kind: CoverKind.Path });
  });

  it("skips the empty layers a colour-only background layer leaves in the list", () => {
    const glow = box({
      "background-image":
        "radial-gradient(480px 400px at 0% 0%, color(srgb 1 0 0 / 0.22), rgba(0, 0, 0, 0) 70%), none",
      "background-color": "rgb(0, 0, 0)",
    });

    const read = readTree(tree(root(), glow));

    expect(read.gaps).toEqual([]);
    expect(read.drawn).toHaveLength(2);
  });

  it("places a single gradient inside the border of a bordered box", () => {
    const sides = Object.fromEntries(
      ["top", "right", "bottom", "left"].flatMap((side) => [
        [`border-${side}-width`, "1px"],
        [`border-${side}-style`, "solid"],
        [`border-${side}-color`, "rgb(255, 255, 255)"],
      ]),
    );
    const pill = box({
      ...sides,
      "background-image": "linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))",
    });

    const read = readTree(tree(root(), pill));

    expect(read.gaps).toEqual([]);
    expect((read.drawn[0] as DrawnPath).paint).toMatchObject({
      kind: PaintKind.Linear,
      from: [100, expect.closeTo(1)],
      to: [100, expect.closeTo(99)],
    });
  });

  it("blurs what is behind a box with a backdrop blur, under the box", () => {
    const glass = box({
      "backdrop-filter": "blur(12px)",
      "background-color": "rgba(255, 255, 255, 0.2)",
    });

    const read = readTree(tree(root(), glass));

    expect(read.gaps).toEqual([]);
    expect(read.drawn).toMatchObject([
      { kind: DrawnKind.Path, backdrop: 12 },
      { kind: DrawnKind.Path },
    ]);
  });

  it("still refuses a backdrop filter other than a blur", () => {
    expect(
      readTree(tree(root(), box({ "backdrop-filter": "saturate(2)" }))).gaps,
    ).toMatchObject([{ reason: DomGap.Filter }]);
  });

  it("carries the perspective through a preserve-3d parent to its children", () => {
    const scene = el({
      parent: 0,
      at: [0, 0],
      size: [400, 300],
      style: { perspective: "400px", "perspective-origin": "200px 150px" },
    });
    const ring = el({
      parent: 1,
      at: [100, 100],
      size: [0, 0],
      style: {
        "transform-style": "preserve-3d",
        transform: "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 200, 1)",
      } as RawNode["style"],
    });
    const card = el({
      parent: 2,
      at: [0, 0],
      size: [200, 100],
      style: { "background-color": "rgb(0, 0, 0)" },
    });

    const read = readTree(tree(root(), scene, ring, card));

    expect(read.gaps).toEqual([]);
    expect(near(bounds(read.drawn[0] as DrawnPath))).toEqual({
      left: 0,
      top: 50,
      right: 400,
      bottom: 250,
    });
  });

  it("turns a child of a preserve-3d parent in depth before the perspective projects it", () => {
    const [cos, sin] = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
    const scene = el({
      parent: 0,
      at: [0, 0],
      size: [400, 300],
      style: { perspective: "400px", "perspective-origin": "200px 150px" },
    });
    const ring = el({
      parent: 1,
      at: [100, 100],
      size: [0, 0],
      style: {
        "transform-style": "preserve-3d",
        transform: "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 100, 1)",
      } as RawNode["style"],
    });
    const card = el({
      parent: 2,
      at: [0, 0],
      size: [200, 100],
      style: {
        "background-color": "rgb(0, 0, 0)",
        transform: `matrix3d(${cos}, 0, ${-sin}, 0, 0, 1, 0, 0, ${sin}, 0, ${cos}, 0, 0, 0, 0, 1)`,
        "transform-origin": "100px 50px",
      },
    });
    const projected = ([x, y]: [number, number]): [number, number] => {
      const [px, pz] = [100 + (x - 100) * cos, -(x - 100) * sin + 100];
      const scale = 400 / (400 - pz);
      return [200 + (px + 100 - 200) * scale, 150 + (y + 100 - 150) * scale];
    };

    const read = readTree(tree(root(), scene, ring, card));
    const item = read.drawn[0] as DrawnPath;
    const points = Array.from({ length: item.contours[0].length / 2 }, (_, i) =>
      apply2d(item.matrix, [
        item.contours[0][2 * i],
        item.contours[0][2 * i + 1],
      ]),
    );
    const miss = (c: [number, number]) =>
      Math.min(
        ...points.map((p) =>
          Math.hypot(p[0] - projected(c)[0], p[1] - projected(c)[1]),
        ),
      );

    expect(read.gaps).toEqual([]);
    expect(
      (
        [
          [0, 0],
          [200, 0],
          [200, 100],
          [0, 100],
        ] as [number, number][]
      ).map(miss),
    ).toEqual([0, 0, 0, 0].map(() => expect.closeTo(0, 1)));
  });
});

describe("backgrounds the reader used to refuse", () => {
  const box = (style: RawNode["style"]) =>
    tree(root(), el({ parent: 0, at: [0, 0], size: [90, 40], style }));
  const area = (c: number[]) =>
    Math.abs(
      c.reduce((s, _, i) => (i % 2 ? s : s + c[i] * c[(i + 3) % c.length] - c[(i + 2) % c.length] * c[i + 1]), 0) / 2,
    );

  it("spells out the colour before the first stop and after the last, which the core would otherwise stretch", () => {
    const [disc] = readTree(
      box({ "background-image": "radial-gradient(20px 20px at 30px 20px, rgb(58, 58, 58) 98%, rgba(0, 0, 0, 0) 100%)" }),
    ).drawn as DrawnPath[];

    expect(disc.paint.kind === PaintKind.Radial && disc.paint.stops.map((s) => s.at)).toEqual([0, expect.closeTo(0.98), 1]);
  });

  it("blends background layers onto the ones below, inside the element", () => {
    const read = readTree(
      box({
        "background-color": "rgb(100, 100, 100)",
        "background-image":
          "linear-gradient(rgb(255, 0, 0), rgb(255, 0, 0)), linear-gradient(rgb(0, 0, 255), rgb(0, 0, 255))",
        "background-blend-mode": "multiply, normal",
      }),
    );
    const [group] = read.drawn;

    expect(read.gaps).toEqual([]);
    expect(group.kind).toBe(DrawnKind.Group);
    expect(group.kind === DrawnKind.Group && group.items.map((i) => i.blend ?? BlendMode.Normal)).toEqual([BlendMode.Normal, BlendMode.Normal, BlendMode.Multiply]);
  });

  it("draws a repeating stripe as one band per period, merged into one path", () => {
    const read = readTree(
      box({
        "background-image":
          "repeating-linear-gradient(90deg, rgb(255, 0, 0) 0px, rgb(255, 0, 0) 2px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0) 9px)",
      }),
    );
    const [stripes] = read.drawn as DrawnPath[];

    expect(read.gaps).toEqual([]);
    expect(stripes.paint).toEqual({ kind: PaintKind.Solid, color: [1, 0, 0, 1] });
    expect(stripes.contours).toHaveLength(10);
    expect(stripes.contours.reduce((s, c) => s + area(c), 0)).toBeCloseTo(10 * 2 * 40, 0);
  });

  it("draws a slanted repeating stripe inside its box", () => {
    const read = readTree(
      box({
        "background-image":
          "repeating-linear-gradient(-62deg, rgb(0, 0, 0) 0px, rgb(0, 0, 0) 3px, rgba(0, 0, 0, 0) 3px, rgba(0, 0, 0, 0) 12px)",
      }),
    );
    const [stripes] = read.drawn as DrawnPath[];

    expect(read.gaps).toEqual([]);
    expect(bounds(stripes)).toMatchObject({ left: expect.closeTo(0, 3), right: expect.closeTo(90, 3) });
    expect(stripes.contours.reduce((s, c) => s + area(c), 0)).toBeCloseTo((90 * 40 * 3) / 12, -2);
  });

  it("shifts a gradient by its background position", () => {
    const read = readTree(
      box({
        "background-image": "linear-gradient(90deg, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)",
        "background-size": "200% 100%",
        "background-position": "-50% 0px",
        "background-repeat": "repeat",
      }),
    );
    const tiles = read.drawn as DrawnPath[];

    expect(read.gaps).toEqual([]);
    expect(tiles.map((t) => [t.paint.kind === PaintKind.Linear && t.paint.from[0], bounds(t).left, bounds(t).right])).toEqual([
      [-135, 0, 45],
      [45, 45, 90],
    ]);
  });

  it("paints text clipped to its background with the background, and no box", () => {
    const read = readTree(
      tree(
        root(),
        el({
          parent: 0,
          size: [60, 20],
          style: {
            color: "rgba(0, 0, 0, 0)",
            "font-family": '"Inter Tight", system-ui',
            "font-size": "10px",
            "background-image": "linear-gradient(90deg, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)",
            "background-clip": "text",
          },
          text: "ab",
          lines: [{ chars: ["a", "b"], xs: [0, 10], top: 0, height: 10 }],
        }),
      ),
      { fonts: boxBook(new Set()), smoothing: Smoothing.Plain },
    );

    expect(read.gaps).toEqual([]);
    expect(read.drawn).toHaveLength(2);
    expect(read.drawn.every((d) => d.kind === DrawnKind.Path && d.paint.kind === PaintKind.Linear)).toBe(true);
  });
});
