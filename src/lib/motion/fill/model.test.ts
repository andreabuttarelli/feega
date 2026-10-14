import { describe, expect, it } from "vitest";
import {
  FillType,
  ImageFit,
  addFill,
  addStop,
  removeStop,
  fillsOf,
  fillsSchema,
  moveFill,
  photoFills,
  removeFill,
  retypeFill,
  setFill,
  type Fill,
} from "./model";

const solid = (color: string, extra: Record<string, unknown> = {}) =>
  fillsSchema.parse([{ type: FillType.Solid, color, ...extra }])[0];
const colors = (stack: Fill[]) =>
  stack.map((f) => (f as { color: string }).color);

describe("fill stack model", () => {
  it("a shape from before fill stacks reads its solid colour as one solid layer", () => {
    expect(fillsOf({ fillKind: "solid", fill: "#ff0000" })).toEqual([
      solid("#ff0000"),
    ]);
  });

  it("a legacy linear gradient becomes a two-stop layer at its angle", () => {
    const [layer] = fillsOf({
      fillKind: "linear",
      fill: "#000000",
      fill2: "#ffffff",
      gradientAngle: 45,
    });
    expect(layer).toMatchObject({
      type: FillType.Linear,
      angle: 45,
      stops: [
        { color: "#000000", pos: 0 },
        { color: "#ffffff", pos: 1 },
      ],
    });
  });

  it("a legacy radial gradient is centred at full radius, and none is an empty stack", () => {
    expect(
      fillsOf({ fillKind: "radial", fill: "#000000", fill2: "#ffffff" })[0],
    ).toMatchObject({
      type: FillType.Radial,
      center: { x: 0.5, y: 0.5 },
      radius: 1,
    });
    expect(fillsOf({ fillKind: "none", fill: "#000000" })).toEqual([]);
  });

  it("a stored stack wins over the legacy colour", () => {
    expect(
      fillsOf({
        fillKind: "solid",
        fill: "#ff0000",
        fills: [{ type: "solid", color: "#00ff00" }],
      }),
    ).toEqual([solid("#00ff00")]);
  });

  it("a layer defaults to visible, fully opaque, normal blend", () => {
    expect(solid("#000000")).toMatchObject({
      opacity: 1,
      visible: true,
      blend: "normal",
    });
  });

  it("opacity outside 0..1 is refused", () => {
    expect(
      fillsSchema.safeParse([{ type: "solid", color: "#000000", opacity: 2 }])
        .success,
    ).toBe(false);
  });

  it("an image layer defaults to cover, centred, unscaled", () => {
    expect(
      fillsSchema.parse([{ type: "image", assetId: "a" }])[0],
    ).toMatchObject({
      fit: ImageFit.Cover,
      focus: { x: 0.5, y: 0.5 },
      scale: 1,
    });
  });

  it("a poster photo from before reads as one image layer with its fit and focus", () => {
    expect(
      photoFills({
        assetId: "a",
        kind: "image",
        fit: "contain",
        focusX: 0.2,
        focusY: 0.8,
      }),
    ).toEqual(
      fillsSchema.parse([
        {
          type: "image",
          assetId: "a",
          fit: "contain",
          focus: { x: 0.2, y: 0.8 },
        },
      ]),
    );
    expect(photoFills({ assetId: "", kind: "image" })).toEqual([]);
  });

  it("a poster photo with a stack reads the stack", () => {
    expect(
      photoFills({
        assetId: "a",
        kind: "image",
        fills: [{ type: "solid", color: "#000000" }],
      }),
    ).toEqual([solid("#000000")]);
  });

  it("add puts the new layer on top, remove takes one out", () => {
    const two = addFill([solid("#111111")], FillType.Solid);
    expect(two).toHaveLength(2);
    expect(two[0]).toEqual(solid("#111111"));
    expect(removeFill(two, 0)).toEqual([two[1]]);
  });

  it("move reorders and clamps into the stack", () => {
    const stack = [solid("#111111"), solid("#222222"), solid("#333333")];
    expect(colors(moveFill(stack, 0, 2))).toEqual([
      "#222222",
      "#333333",
      "#111111",
    ]);
    expect(colors(moveFill(stack, 0, 9))).toEqual([
      "#222222",
      "#333333",
      "#111111",
    ]);
  });

  it("set patches one layer, clamping opacity", () => {
    expect(setFill([solid("#111111")], 0, { opacity: 3 })[0].opacity).toBe(1);
    expect(setFill([solid("#111111")], 0, { visible: false })[0].visible).toBe(
      false,
    );
  });

  it("a stop added on the bar takes the colour of the stop before it", () => {
    const stops = [
      { color: "#000000", pos: 0 },
      { color: "#ffffff", pos: 1 },
    ];
    expect(addStop(stops, 0.4)).toEqual([
      ...stops,
      { color: "#000000", pos: 0.4 },
    ]);
  });

  it("a gradient keeps at least two stops", () => {
    const stops = [
      { color: "#000000", pos: 0 },
      { color: "#ffffff", pos: 1 },
    ];
    expect(removeStop(stops, 0)).toEqual(stops);
    expect(removeStop([...stops, { color: "#ff0000", pos: 0.5 }], 2)).toEqual(
      stops,
    );
  });

  it("retype keeps opacity, visibility and blend, and carries the colour into the stops", () => {
    const [layer] = retypeFill(
      [solid("#123456", { opacity: 0.4, blend: "multiply" })],
      0,
      FillType.Linear,
    );
    expect(layer).toMatchObject({
      type: FillType.Linear,
      opacity: 0.4,
      blend: "multiply",
    });
    expect((layer as { stops: { color: string }[] }).stops[0].color).toBe(
      "#123456",
    );
  });
});
