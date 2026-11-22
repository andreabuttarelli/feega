import type { ReactNode } from "react";
import { MONO } from "../theme";
import type { Rect } from "./Terminal";

const UI = '-apple-system, "SF Pro Text", "Segoe UI", "Helvetica Neue", sans-serif';

const C = {
  chrome: "#181818",
  editor: "#1f1f1f",
  border: "#2b2b2b",
  text: "#cccccc",
  dim: "#9d9d9d",
  faint: "#6e7681",
  accent: "#0078d4",
  selection: "#37373d",
};

const TITLE = 36;
const STATUS = 24;
const ACTIVITY = 48;
const SIDEBAR = 240;
const TABS = 35;
const PANEL_TABS = 34;
const PANEL_HEIGHT = 470;

export const VSCODE: Rect = { x: 500, y: 170, w: 1120, h: 790 };


const Stroke = ({ d, size = 24, color = C.faint }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ACTIVITY_ICONS = [
  "M14 3H7a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M3 7v13a1 1 0 0 0 1 1h10",
  "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L21 21",
  "M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 6-12 3-12 9",
  "M7 4v16l13-8z",
  "M4 4h7v7H4zM4 13h7v7H4zM13 13h7v7h-7zM16.5 3.5l4 4-4 4-4-4z",
];

const FILES: { name: string; depth: number; folder?: boolean; color: string; active?: boolean }[] = [
  { name: "public", depth: 0, folder: true, color: C.dim },
  { name: "src", depth: 0, folder: true, color: C.dim },
  { name: "app.js", depth: 1, color: "#cbcb41" },
  { name: "index.html", depth: 0, color: "#e44d26", active: true },
  { name: "styles.css", depth: 0, color: "#519aba" },
  { name: "package.json", depth: 0, color: "#cbcb41" },
  { name: "README.md", depth: 0, color: "#519aba" },
];

type Token = [string, string];

const CODE: Token[][] = [
  [["<!doctype ", "#808080"], ["html", "#569cd6"], [">", "#808080"]],
  [["<", "#808080"], ["html", "#569cd6"], [" lang", "#9cdcfe"], ["=", C.text], ['"en"', "#ce9178"], [">", "#808080"]],
  [["  <", "#808080"], ["head", "#569cd6"], [">", "#808080"]],
  [["    <", "#808080"], ["title", "#569cd6"], [">", "#808080"], ["Lumen", C.text], ["</", "#808080"], ["title", "#569cd6"], [">", "#808080"]],
  [["    <", "#808080"], ["link", "#569cd6"], [" rel", "#9cdcfe"], ["=", C.text], ['"stylesheet"', "#ce9178"], [" href", "#9cdcfe"], ["=", C.text], ['"styles.css"', "#ce9178"], [" />", "#808080"]],
  [["  </", "#808080"], ["head", "#569cd6"], [">", "#808080"]],
  [["  <", "#808080"], ["body", "#569cd6"], [">", "#808080"]],
  [["    <", "#808080"], ["div", "#569cd6"], [" id", "#9cdcfe"], ["=", C.text], ['"app"', "#ce9178"], ["></", "#808080"], ["div", "#569cd6"], [">", "#808080"]],
];

const TitleBar = () => (
  <div style={{ height: TITLE, background: C.chrome, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 14px", position: "relative" }}>
    <div style={{ display: "flex", gap: 8 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
      ))}
    </div>
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        width: 380,
        height: 24,
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        background: "#222",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        color: C.dim,
        fontSize: 13,
      }}
    >
      <Stroke d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L21 21" size={14} color={C.dim} />
      startup
    </div>
  </div>
);

const ActivityBar = () => (
  <div style={{ width: ACTIVITY, background: C.chrome, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 6 }}>
    {ACTIVITY_ICONS.map((d, i) => (
      <div key={d} style={{ height: 48, width: ACTIVITY, display: "flex", alignItems: "center", justifyContent: "center", borderLeft: `2px solid ${i === 0 ? C.accent : "transparent"}` }}>
        <Stroke d={d} color={i === 0 ? "#d7d7d7" : C.faint} />
      </div>
    ))}
    <div style={{ marginTop: "auto", paddingBottom: 10, display: "flex", flexDirection: "column", gap: 18 }}>
      <Stroke d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
      <Stroke d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </div>
  </div>
);

const Explorer = () => (
  <div style={{ width: SIDEBAR, background: C.chrome, borderRight: `1px solid ${C.border}`, color: C.text, fontSize: 13 }}>
    <div style={{ height: TABS, display: "flex", alignItems: "center", padding: "0 20px", fontSize: 11, letterSpacing: 0.6, color: C.dim }}>EXPLORER</div>
    <div style={{ height: 22, display: "flex", alignItems: "center", padding: "0 6px", fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>⌄ STARTUP</div>
    {FILES.map((f) => (
      <div
        key={f.name}
        style={{
          height: 22,
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingLeft: 18 + f.depth * 14,
          background: f.active ? C.selection : undefined,
          outline: f.active ? `1px solid ${C.accent}` : undefined,
          outlineOffset: -1,
        }}
      >
        <span style={{ width: 10, color: C.dim, fontSize: 11 }}>{f.folder ? "›" : ""}</span>
        <span style={{ width: 14, color: f.color, fontSize: 12, fontWeight: 700 }}>{f.folder ? "" : "▪"}</span>
        {f.name}
      </div>
    ))}
  </div>
);

const Editor = () => (
  <div style={{ flex: 1, background: C.editor, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <div style={{ height: TABS, background: C.chrome, display: "flex", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
      {["index.html", "styles.css"].map((t, i) => (
        <div
          key={t}
          style={{
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: i === 0 ? C.editor : C.chrome,
            color: i === 0 ? "#fff" : C.dim,
            borderTop: `1px solid ${i === 0 ? C.accent : "transparent"}`,
            borderRight: `1px solid ${C.border}`,
          }}
        >
          <span style={{ color: i === 0 ? "#e44d26" : "#519aba", fontWeight: 700 }}>▪</span>
          {t}
          {i === 0 && <span style={{ color: C.dim, marginLeft: 6 }}>×</span>}
        </div>
      ))}
    </div>
    <div style={{ height: 22, display: "flex", alignItems: "center", padding: "0 16px", fontSize: 12, color: C.dim }}>startup › index.html</div>
    <div style={{ fontFamily: MONO, fontSize: 14, lineHeight: "21px", whiteSpace: "pre" }}>
      {CODE.map((line, i) => (
        <div key={i} style={{ display: "flex" }}>
          <span style={{ width: 52, textAlign: "right", paddingRight: 22, color: C.faint }}>{i + 1}</span>
          {line.map(([text, color], j) => (
            <span key={j} style={{ color }}>
              {text}
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const PANEL_TAB_NAMES = ["PROBLEMS", "OUTPUT", "DEBUG CONSOLE", "TERMINAL", "PORTS"];

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ height: PANEL_HEIGHT, background: C.chrome, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
    <div style={{ height: PANEL_TABS, display: "flex", alignItems: "center", gap: 22, padding: "0 18px", fontSize: 11, letterSpacing: 0.5, color: C.dim }}>
      {PANEL_TAB_NAMES.map((t) => (
        <span key={t} style={{ color: t === "TERMINAL" ? "#e7e7e7" : undefined, borderBottom: `1px solid ${t === "TERMINAL" ? "#e7e7e7" : "transparent"}`, paddingBottom: 4, marginTop: 5 }}>
          {t}
        </span>
      ))}
      <span style={{ marginLeft: "auto", fontSize: 12, color: C.text }}>⌨ {title}</span>
      <span style={{ fontSize: 14 }}>+ ⌄ ⋯ ⌃ ×</span>
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
  </div>
);

const StatusBar = () => (
  <div style={{ height: STATUS, background: C.chrome, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", fontSize: 12, color: C.dim, gap: 14 }}>
    <div style={{ background: C.accent, color: "#fff", height: "100%", width: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⟩⟨</div>
    <span>⑂ main</span>
    <span>⊗ 0 ⚠ 0</span>
    <span style={{ marginLeft: "auto" }}>Ln 1, Col 1</span>
    <span>Spaces: 2</span>
    <span>UTF-8</span>
    <span>LF</span>
    <span style={{ paddingRight: 14 }}>HTML</span>
  </div>
);

type Props = { rect: Rect; shell: string; children: ReactNode };

export const VSCodeWindow = ({ rect, shell, children }: Props) => (
  <div
    style={{
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid #3a3a3a",
      boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
      display: "flex",
      flexDirection: "column",
      fontFamily: UI,
      background: C.editor,
    }}
  >
    <TitleBar />
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <ActivityBar />
      <Explorer />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Editor />
        <Panel title={shell}>{children}</Panel>
      </div>
    </div>
    <StatusBar />
  </div>
);
