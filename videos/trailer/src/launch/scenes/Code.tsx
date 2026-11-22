import { useCurrentFrame } from "remotion";
import { lift, tween } from "../../ease";
import { Align, Headline } from "../Headline";
import { Place, Section } from "../Section";
import { MONO, Tone } from "../style";

export const CODE_FRAMES = 120;
export const DIFF_LINES_AT = 30;

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

const LINES: { kind: Kind; text: string }[] = [
  { kind: Kind.Same, text: '<main class="hero">' },
  { kind: Kind.Removed, text: '  <h1 class="text-[56px] text-black">' },
  { kind: Kind.Added, text: '  <h1 class="text-[80px] text-[#ff5100]">' },
  { kind: Kind.Same, text: "    ship faster." },
  { kind: Kind.Same, text: "  </h1>" },
  { kind: Kind.Same, text: '  <p class="lead">…</p>' },
  { kind: Kind.Same, text: "</main>" },
];

const LINE_STAGGER = 5;

export const Code = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, 6, 20);

  return (
    <Section tone={Tone.Orange} eyebrow="03 · ship">
      <Place x={100} y={330}>
        <Headline lines={["every edit", "lands in", "your code."]} boxed="code" tone={Tone.Orange} size={116} align={Align.Left} />
      </Place>
      <Place x={880} y={290} style={{ transform: `translateX(${(1 - enter) * 1100}px)` }}>
        <div style={{ width: 920, borderRadius: 16, background: "#141413", fontFamily: MONO, fontSize: 25, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,.25)" }}>
          <div style={{ padding: "18px 26px", color: "#8a8780", borderBottom: "1px solid #2a2a28", display: "flex", justifyContent: "space-between" }}>
            <span>src/routes/+page.svelte</span>
            <span><span style={{ color: "#8fe8b4" }}>+1</span> <span style={{ color: "#ff9a9a" }}>−1</span></span>
          </div>
          <div style={{ padding: "14px 0" }}>
            {LINES.map((line, i) => {
              const p = lift(frame, DIFF_LINES_AT + i * LINE_STAGGER, 10);
              const style = KIND_STYLE[line.kind];

              return (
                <div key={i} style={{ display: "flex", gap: 22, padding: "6px 26px", background: style.bg, color: style.fg, whiteSpace: "pre", opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
                  <span style={{ width: 14 }}>{style.sign}</span>
                  {line.text}
                </div>
              );
            })}
          </div>
        </div>
      </Place>
    </Section>
  );
};
