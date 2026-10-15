import { describe, expect, it } from "vitest";
import { FEEGA_TOKENS } from "../brand";
import { MotionFormat, newMotionDoc, type MotionDoc } from "../doc";
import { setStill } from "../still";
import { addClip, type OpResult } from "../timeline";
import { composeHtml } from "./compose";

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const withText = (doc: MotionDoc, from: number) =>
  must(
    addClip(
      doc,
      { component: "Text", from, durationInFrames: 90, props: { text: "Hi" } },
      "tx",
    ),
  );
const compose = (doc: MotionDoc) =>
  composeHtml({
    doc,
    tokens: FEEGA_TOKENS,
    assets: {},
    origin: "https://app.test",
  });
const fades = (html: string) => html.includes('tl.fromTo("#tx-tx"');

describe("a still shows text at rest", () => {
  it("text added on the still frame does not wait for its fade-in", () => {
    const still = must(setStill(newMotionDoc(MotionFormat.Landscape), 0));
    expect(fades(compose(withText(still, 0)))).toBe(false);
  });

  it("a still pinned after the fade keeps it, so older stills render the same", () => {
    const still = must(setStill(newMotionDoc(MotionFormat.Landscape), 2));
    expect(fades(compose(withText(still, 0)))).toBe(true);
  });

  it("a video fades text in", () => {
    expect(
      fades(compose(withText(newMotionDoc(MotionFormat.Landscape), 0))),
    ).toBe(true);
  });
});
