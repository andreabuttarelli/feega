import type { CSSProperties } from "react";
import { COLORS, MONO, SANS } from "../theme";

export enum LineKind {
  User = "user",
  Agent = "agent",
  Status = "status",
  Spinner = "spinner",
  Limit = "limit",
}

export type TermLine = { kind: LineKind; text: string };

export type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  rect: Rect;
  title: string;
  lines: TermLine[];
  input: string;
  cursorOn: boolean;
  spinnerGlyph: string;
};

const FONT = 22;

const frame = (rect: Rect): CSSProperties => ({
  position: "absolute",
  left: rect.x,
  top: rect.y,
  width: rect.w,
  height: rect.h,
  background: COLORS.terminal,
  border: `1px solid ${COLORS.terminalBorder}`,
  borderRadius: 18,
  boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  fontFamily: MONO,
  fontSize: FONT,
  color: COLORS.text,
});

const Dots = () => (
  <div style={{ display: "flex", gap: 9 }}>
    {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
      <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
    ))}
  </div>
);

const Cursor = ({ on }: { on: boolean }) => (
  <span
    style={{
      display: "inline-block",
      width: 12,
      height: 26,
      marginLeft: 2,
      verticalAlign: "-5px",
      background: COLORS.text,
      opacity: on ? 1 : 0,
    }}
  />
);

const Welcome = () => (
  <div
    style={{
      border: `1.5px solid ${COLORS.accent}`,
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 26,
    }}
  >
    <div>
      <span style={{ color: COLORS.accent }}>✻</span> Welcome to <b>agent</b>
    </div>
    <div style={{ color: COLORS.muted, marginTop: 10, fontSize: 18 }}>/help for help · cwd: ~/startup</div>
  </div>
);

const Line = ({ line, glyph }: { line: TermLine; glyph: string }) => {
  if (line.kind === LineKind.User) {
    return <div style={{ color: COLORS.muted, margin: "18px 0 10px" }}>&gt; {line.text}</div>;
  }

  if (line.kind === LineKind.Status) {
    return <div style={{ color: COLORS.muted, paddingLeft: 34, fontSize: 19, marginTop: 4 }}>⎿ {line.text}</div>;
  }

  if (line.kind === LineKind.Spinner) {
    return (
      <div style={{ color: COLORS.accent, marginTop: 6 }}>
        {glyph} {line.text}
      </div>
    );
  }

  if (line.kind === LineKind.Limit) {
    return (
      <div
        style={{
          marginTop: 10,
          border: `1.5px solid ${COLORS.danger}`,
          borderRadius: 10,
          padding: "14px 18px",
          color: COLORS.danger, whiteSpace: "pre-line",
        }}
      >
        {line.text}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6 }}>
      <span style={{ color: COLORS.accent }}>⏺</span> {line.text}
    </div>
  );
};

export const Terminal = ({ rect, title, lines, input, cursorOn, spinnerGlyph }: Props) => (
  <div style={frame(rect)}>
    <div
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        borderBottom: `1px solid ${COLORS.terminalBorder}`,
        position: "relative",
      }}
    >
      <Dots />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 17,
          color: COLORS.muted,
        }}
      >
        {title}
      </div>
    </div>

    <div style={{ flex: 1, padding: "26px 28px 0", display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
      <Welcome />
      {lines.map((line, i) => (
        <Line key={i} line={line} glyph={spinnerGlyph} />
      ))}
    </div>

    <div style={{ padding: "22px 28px 28px" }}>
      <div
        style={{
          border: `1.5px solid ${COLORS.terminalBorder}`,
          borderRadius: 10,
          padding: "16px 18px",
          whiteSpace: "pre",
        }}
      >
        <span style={{ color: COLORS.muted }}>&gt; </span>
        {input}
        <Cursor on={cursorOn} />
      </div>
      <div style={{ color: COLORS.muted, fontSize: 16, marginTop: 10, paddingLeft: 4 }}>? for shortcuts</div>
    </div>
  </div>
);
