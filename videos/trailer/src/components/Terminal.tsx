import { MONO } from "../theme";

export enum LineKind {
  User = "user",
  Agent = "agent",
  Tool = "tool",
  Spinner = "spinner",
  Limit = "limit",
}

export type TermLine = { kind: LineKind; text: string };

export type Rect = { x: number; y: number; w: number; h: number };

export const TERM_FONT = 19;

const PG = { violet: "#a78bfa", pink: "#f472b6" };

const CC = {
  text: "#e6e6e6",
  muted: "#8b8b8b",
  border: "#6e6e6e",
  green: "#4eba65",
  red: "#ff6b80",
};

const Caret = ({ on }: { on: boolean }) => (
  <span style={{ display: "inline-block", width: TERM_FONT * 0.6, height: TERM_FONT * 1.2, verticalAlign: "-4px", background: CC.text, opacity: on ? 1 : 0 }} />
);

export const PixelgodLogo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <defs>
      <linearGradient id="pixelgod" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={PG.violet} />
        <stop offset="1" stopColor={PG.pink} />
      </linearGradient>
    </defs>
    <path d="M2 18L4 6l5 5 3-8 3 8 5-5 2 12z" fill="url(#pixelgod)" />
    <rect x="2" y="19.5" width="20" height="2.5" rx="1" fill="url(#pixelgod)" />
  </svg>
);

const Welcome = () => (
  <div style={{ border: `1.5px solid ${PG.violet}`, borderRadius: 8, padding: "10px 16px", marginBottom: 18, alignSelf: "flex-start" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <PixelgodLogo size={TERM_FONT * 1.2} />
      <b style={{ color: PG.violet, letterSpacing: 2 }}>PIXELGOD</b>
      <span style={{ color: CC.muted }}>v6.6.6</span>
    </div>
    <div style={{ marginTop: 10, color: CC.text }}>The last designer you will ever need.</div>
    <div style={{ color: CC.muted, marginTop: 8 }}>Describe a vibe. Get a masterpiece. · cwd: ~/startup</div>
  </div>
);

const Line = ({ line, glyph }: { line: TermLine; glyph: string }) => {
  if (line.kind === LineKind.User) {
    return <div style={{ color: CC.muted, margin: "14px 0 8px" }}>&gt; {line.text}</div>;
  }

  if (line.kind === LineKind.Tool) {
    return (
      <div style={{ marginTop: 6 }}>
        <span style={{ color: CC.green }}>⏺</span> <b>{line.text}</b>
      </div>
    );
  }

  if (line.kind === LineKind.Spinner) {
    return (
      <div style={{ marginTop: 8 }}>
        <span style={{ color: PG.violet }}>{glyph} {line.text}</span> <span style={{ color: CC.muted }}>(press esc to doubt)</span>
      </div>
    );
  }

  if (line.kind === LineKind.Limit) {
    return (
      <div style={{ marginTop: 10, border: `1.5px solid ${CC.red}`, borderRadius: 8, padding: "10px 16px", color: CC.red, whiteSpace: "pre-line" }}>
        {line.text}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <span style={{ color: PG.violet }}>◆</span> {line.text}
    </div>
  );
};

type Props = {
  lines: TermLine[];
  input: string;
  cursorOn: boolean;
  spinnerGlyph: string;
};

export const PixelgodTui = ({ lines, input, cursorOn, spinnerGlyph }: Props) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontFamily: MONO, fontSize: TERM_FONT, color: CC.text, padding: "12px 20px 10px" }}>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
      <Welcome />
      {lines.map((line, i) => (
        <Line key={i} line={line} glyph={spinnerGlyph} />
      ))}
    </div>

    <div style={{ marginTop: 14, border: `1.5px solid ${CC.border}`, borderRadius: 8, padding: "8px 14px", whiteSpace: "pre", overflow: "hidden", fontVariantLigatures: "none", fontKerning: "none" }}>
      <span style={{ color: CC.text }}>&gt; </span>
      {input}
      <Caret on={cursorOn} />
    </div>
    <div style={{ color: CC.muted, fontSize: TERM_FONT * 0.8, marginTop: 6, paddingLeft: 14 }}>? for shortcuts</div>
  </div>
);

export const Shell = ({ command, cursorOn }: { command: string; cursorOn: boolean }) => (
  <div style={{ position: "absolute", inset: 0, fontFamily: MONO, fontSize: TERM_FONT, color: CC.text, padding: "12px 20px" }}>
    <div style={{ color: CC.muted }}>Last login: Sun Nov 22 09:41:07 on ttys002</div>
    <div style={{ marginTop: 4, whiteSpace: "pre" }}>
      <span style={{ color: CC.green }}>you@MacBook</span> <span style={{ color: "#5fa8ff" }}>startup</span> % {command}
      <Caret on={cursorOn} />
    </div>
  </div>
);
