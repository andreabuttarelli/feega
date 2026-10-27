import { describe, expect, it } from "vitest";
import { Ease } from "@feega/motion-core/motion/design";
import {
  MotionFormat,
  findClip,
  newMotionDoc,
  type MotionDoc,
} from "@feega/motion-core/motion/doc";
import { addClip, type OpResult } from "@feega/motion-core/motion/timeline";
import {
  IN_OUT_PRESETS,
  InOutPreset,
  PresetSide,
  applyInOut,
  presetsFor,
} from "./in-out-presets";

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const FPS_DURATION = 120;
type Component = Parameters<typeof addClip>[1]["component"];
const withClip = (component: Component) =>
  must(
    addClip(
      newMotionDoc(MotionFormat.Landscape),
      { component, from: 0, durationInFrames: FPS_DURATION },
      "c",
    ),
  );
const keysOf = (doc: MotionDoc, prop: string) =>
  findClip(doc, "c")!.clip.keyframes[prop].map((k) => [k.frame, k.value]);
const run = (
  doc: MotionDoc,
  preset: InOutPreset,
  side: PresetSide,
  extra: { duration?: number; at?: number } = {},
) => applyInOut(doc, "c", { preset, side, ...extra }, () => "text1");

describe("applyInOut", () => {
  it("fade in keys opacity from hidden at the clip start to its resting value", () => {
    const doc = must(
      run(withClip("Shape"), InOutPreset.Fade, PresetSide.In, { duration: 18 }),
    );

    expect(keysOf(doc, "opacity")).toEqual([
      [0, 0],
      [18, 1],
    ]);
  });

  it("fade out ends hidden on the last frame of the clip", () => {
    const doc = must(
      run(withClip("Shape"), InOutPreset.Fade, PresetSide.Out, {
        duration: 18,
      }),
    );

    expect(keysOf(doc, "opacity")).toEqual([
      [FPS_DURATION - 1 - 18, 1],
      [FPS_DURATION - 1, 0],
    ]);
  });

  it("at the playhead starts there", () => {
    const doc = must(
      run(withClip("Shape"), InOutPreset.Fade, PresetSide.In, {
        duration: 10,
        at: 40,
      }),
    );

    expect(keysOf(doc, "opacity")).toEqual([
      [40, 0],
      [50, 1],
    ]);
  });

  it("slide up in starts below its resting place and fades in", () => {
    const doc = must(
      run(withClip("Shape"), InOutPreset.SlideUp, PresetSide.In, {
        duration: 20,
      }),
    );

    expect(keysOf(doc, "y")[0][1]).toBeGreaterThan(0);
    expect(keysOf(doc, "y")[1]).toEqual([20, 0]);
    expect(keysOf(doc, "opacity")[0][1]).toBe(0);
  });

  it("slide left and right mirror each other on x", () => {
    const left = keysOf(
      must(run(withClip("Shape"), InOutPreset.SlideLeft, PresetSide.In)),
      "x",
    )[0][1] as number;
    const right = keysOf(
      must(run(withClip("Shape"), InOutPreset.SlideRight, PresetSide.In)),
      "x",
    )[0][1] as number;

    expect(left).toBe(-right);
  });

  it("slide out ends displaced in the direction named", () => {
    const doc = must(
      run(withClip("Shape"), InOutPreset.SlideDown, PresetSide.Out),
    );

    expect(keysOf(doc, "y")[0][1]).toBe(0);
    expect(keysOf(doc, "y")[1][1]).toBeGreaterThan(0);
  });

  it("scale and blur in start small and blurred", () => {
    const scaled = must(
      run(withClip("Shape"), InOutPreset.Scale, PresetSide.In),
    );
    const blurred = must(
      run(withClip("Shape"), InOutPreset.BlurIn, PresetSide.In),
    );

    expect(keysOf(scaled, "scale")[0][1]).toBeLessThan(1);
    expect(keysOf(blurred, "blur")[0][1]).toBeGreaterThan(0);
  });

  it("keeps the value a clip already rests at", () => {
    const base = must(run(withClip("Shape"), InOutPreset.Scale, PresetSide.In));
    const again = must(run(base, InOutPreset.Fade, PresetSide.In));

    expect(keysOf(again, "scale")).toEqual(keysOf(base, "scale"));
  });

  it("replaces the keys of an earlier preset in the same span", () => {
    const first = must(
      run(withClip("Shape"), InOutPreset.Fade, PresetSide.In, { duration: 20 }),
    );
    const second = must(
      run(first, InOutPreset.Fade, PresetSide.In, { duration: 10 }),
    );

    expect(keysOf(second, "opacity")).toEqual([
      [0, 0],
      [10, 1],
      [20, 1],
    ]);
  });

  it("never uses a bouncy, springy or linear ease", () => {
    const doc = must(run(withClip("Shape"), InOutPreset.Pop, PresetSide.In));
    const eases = Object.values(findClip(doc, "c")!.clip.keyframes)
      .flat()
      .map((k) => k.ease);

    expect(eases.every((e) => e === Ease.Standard)).toBe(true);
  });

  it("typewriter adds a text animator and keys nothing else", () => {
    const doc = must(
      run(withClip("Title"), InOutPreset.Typewriter, PresetSide.In),
    );

    expect(findClip(doc, "c")!.clip.animators.map((a) => a.id)).toEqual([
      "text1",
    ]);
    expect(findClip(doc, "c")!.clip.keyframes.opacity).toBeUndefined();
  });

  it("refuses typewriter on a shape and on the out side", () => {
    expect(
      run(withClip("Shape"), InOutPreset.Typewriter, PresetSide.In).ok,
    ).toBe(false);
    expect(
      run(withClip("Title"), InOutPreset.Typewriter, PresetSide.Out).ok,
    ).toBe(false);
  });

  it("refuses an unknown clip", () => {
    expect(
      applyInOut(
        withClip("Shape"),
        "nope",
        { preset: InOutPreset.Fade, side: PresetSide.In },
        () => "x",
      ).ok,
    ).toBe(false);
  });
});

describe("presetsFor", () => {
  it("offers typewriter only on text, only going in", () => {
    expect(presetsFor("Title", PresetSide.In)).toContain(
      InOutPreset.Typewriter,
    );
    expect(presetsFor("Title", PresetSide.Out)).not.toContain(
      InOutPreset.Typewriter,
    );
    expect(presetsFor("Shape", PresetSide.In)).not.toContain(
      InOutPreset.Typewriter,
    );
  });

  it("lists every registry row on the in side of a text clip", () => {
    expect(presetsFor("Title", PresetSide.In).sort()).toEqual(
      Object.keys(IN_OUT_PRESETS).sort(),
    );
  });
});
