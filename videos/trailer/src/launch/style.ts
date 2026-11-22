import { continueRender, delayRender, staticFile } from "remotion";

export const INK = "#0b0b0a";
export const PAPER = "#f7f6f2";
export const ORANGE = "#ff5100";
export const BLUE = "#004dff";

export const DISPLAY = '"BDO Grotesk", "Inter Tight", -apple-system, sans-serif';
export const MONO = '"Fragment Mono", "SF Mono", Menlo, monospace';
export const UI = '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif';

const FONTS = [
  { family: "BDO Grotesk", file: "fonts/bdo-grotesk-variable.woff2" },
  { family: "Fragment Mono", file: "fonts/fragment-mono-latin.woff2" },
];

let loaded = false;

export const loadFonts = () => {
  if (loaded || typeof document === "undefined") {
    return;
  }

  loaded = true;
  const handle = delayRender("fonts");
  const loads = FONTS.map(({ family, file }) => {
    const face = new FontFace(family, `url(${staticFile(file)})`, { weight: "100 900" });
    document.fonts.add(face);
    return face.load();
  });

  Promise.all(loads).then(() => continueRender(handle));
};

export enum Tone {
  Paper = "paper",
  Ink = "ink",
  Orange = "orange",
}

export const TONES: Record<Tone, { bg: string; fg: string; box: string; boxFg: string; muted: string }> = {
  [Tone.Paper]: { bg: PAPER, fg: INK, box: ORANGE, boxFg: PAPER, muted: "#8a8780" },
  [Tone.Ink]: { bg: INK, fg: PAPER, box: ORANGE, boxFg: PAPER, muted: "#8a8780" },
  [Tone.Orange]: { bg: ORANGE, fg: PAPER, box: INK, boxFg: PAPER, muted: "#ffd3bd" },
};
