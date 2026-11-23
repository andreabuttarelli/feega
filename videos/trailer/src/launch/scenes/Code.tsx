import { useCurrentFrame } from "remotion";
import { lift, tween } from "../../ease";
import { EDITOR_REST, FeegaEditor, SWATCHES } from "../editor/FeegaEditor";
import { Tab } from "../editor/layout";
import { Align, Headline } from "../Headline";
import { Place, Section } from "../Section";
import { Format, useStage } from "../stage";
import { MONO, ORANGE, PAPER, Tone } from "../style";

export const CODE_FRAMES = 97;
export const CODE_TONE = Tone.Paper;
export const DIFF_IN = 16;
export const DIFF_LINES_AT = 30;

const APP_SLIDE = 260;
const DIFF_SLIDE = 900;

const LAYOUT = {
  [Format.Wide]: { appScale: 0.98, editorAt: { x: -150, y: 20 }, diffAt: { x: 900, y: 330 }, diffScale: 1, title: { at: { x: 100, y: 790 }, lines: ["every edit lands in your code."], size: 108, align: Align.Left, width: undefined } },
  [Format.Tall]: { appScale: 0.78, editorAt: { x: 41, y: 690 }, diffAt: { x: 90, y: 1295 }, diffScale: 0.85, title: { at: { x: 0, y: 262 }, lines: ["every edit", "lands in", "your code."], size: 112, align: Align.Center, width: 1080 } },
};

const LINE_STAGGER = 4;
const MUTED = "#8a8780";

enum Kind {
  Same = "same",
  Removed = "removed",
  Added = "added",
}

const KIND_STYLE: Record<Kind, { sign: string; bg: string; fg: string }> = {
  [Kind.Same]: { sign: " ", bg: "transparent", fg: "#bdbab3" },
  [Kind.Removed]: { sign: "−", bg: "rgba(255,90,90,.14)", fg: "#ff9a9a" },
  [Kind.Added]: { sign: "+", bg: "rgba(80,220,140,.14)", fg: "#8fe8b4" },
};

const LINES: { kind: Kind; n: number; text: string }[] = [
  { kind: Kind.Same, n: 12, text: '<section class="hero">' },
  { kind: Kind.Removed, n: 13, text: '  <h1 class="text-[#14142b]">' },
  { kind: Kind.Added, n: 13, text: '  <h1 class="text-[#ff5100]">' },
  { kind: Kind.Same, n: 14, text: "    see every deploy" },
  { kind: Kind.Same, n: 15, text: "  </h1>" },
];

export const DIFF_TICKS = LINES.map((_, i) => DIFF_LINES_AT + i * LINE_STAGGER);

const Diff = ({ frame }: { frame: number }) => (
  <div style={{ width: 980, borderRadius: 28, background: "#141413", fontFamily: MONO, fontSize: 27, overflow: "hidden", boxShadow: "0 0 0 1px rgba(247,246,242,.08), 0 60px 140px rgba(0,0,0,.4)" }}>
    <div style={{ padding: "26px 34px", display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(247,246,242,.08)", color: PAPER }}>
      <span style={{ padding: "4px 12px", borderRadius: 10, background: ORANGE, fontSize: 19 }}>Changes</span>
      <span style={{ color: MUTED }}>src/lib/Hero.svelte</span>
      <span style={{ marginLeft: "auto" }}>
        <span style={{ color: "#8fe8b4" }}>+1</span> <span style={{ color: "#ff9a9a" }}>−1</span>
      </span>
    </div>
    <div style={{ padding: "18px 0" }}>
      {LINES.map((line, i) => {
        const p = lift(frame, DIFF_TICKS[i], 10);
        const style = KIND_STYLE[line.kind];

        return (
          <div key={i} style={{ display: "flex", gap: 22, padding: "9px 34px", background: style.bg, color: style.fg, whiteSpace: "pre", opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
            <span style={{ width: 34, color: "#5c5a55", textAlign: "right" }}>{line.n}</span>
            <span style={{ width: 14 }}>{style.sign}</span>
            {line.text}
          </div>
        );
      })}
    </div>
  </div>
);

export const Code = () => {
  const frame = useCurrentFrame();
  const L = LAYOUT[useStage().format];
  const app = tween(frame, 0, 18);
  const diff = tween(frame, DIFF_IN, 18);
  const state = { ...EDITOR_REST, tab: Tab.Changes, selected: 1, fontSize: 76, headColor: SWATCHES[1], changes: 8, saved: 1 };

  return (
    <Section tone={CODE_TONE}>
      <Place x={L.editorAt.x} y={L.editorAt.y} style={{ transform: `translate(${(app - 1) * APP_SLIDE}px, ${(app - 1) * APP_SLIDE}px) scale(${L.appScale})`, transformOrigin: "0 0" }}>
        <FeegaEditor state={state} />
      </Place>
      <Place x={L.diffAt.x} y={L.diffAt.y} style={{ transform: `translateX(${(1 - diff) * DIFF_SLIDE}px) rotate(${(1 - diff) * 5}deg) scale(${L.diffScale})`, transformOrigin: "0 0" }}>
        <Diff frame={frame} />
      </Place>
      <Place x={L.title.at.x} y={L.title.at.y} style={{ width: L.title.width }}>
        <Headline lines={L.title.lines} boxed="code" tone={CODE_TONE} size={L.title.size} align={L.title.align} />
      </Place>
    </Section>
  );
};
