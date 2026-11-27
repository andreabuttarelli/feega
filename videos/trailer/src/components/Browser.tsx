import type { ReactNode } from "react";
import { SANS } from "../theme";
import type { Rect } from "./Terminal";

export enum Chrome {
  Light = "light",
  Dark = "dark",
}

const PALETTE = {
  [Chrome.Light]: { bar: "#dfe1e5", tab: "#fff", text: "#333", field: "#f1f3f4", page: "#fff", line: "#e5e5e5" },
  [Chrome.Dark]: { bar: "#202124", tab: "#35363a", text: "#e8eaed", field: "#282a2d", page: "#000", line: "#2f3336" },
};

type Props = {
  chrome?: Chrome;
  rect: Rect;
  url: string;
  tab: string;
  opacity: number;
  scale: number;
  children: ReactNode;
};

export const CHROME_HEIGHT = 92;

export const Browser = ({ chrome = Chrome.Light, rect, url, tab, opacity, scale, children }: Props) => {
  const p = PALETTE[chrome];

  return (
  <div
    style={{
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      borderRadius: 16,
      overflow: "hidden",
      background: p.page,
      boxShadow: "0 50px 140px rgba(0,0,0,0.65)",
      opacity,
      transform: `scale(${scale})`,
      fontFamily: SANS,
    }}
  >
    <div style={{ height: CHROME_HEIGHT, background: p.bar, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", padding: "0 16px", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, paddingBottom: 14 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
        </div>
        <div
          style={{
            background: p.tab,
            borderRadius: "10px 10px 0 0",
            height: 34,
            width: 220,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            fontSize: 14,
            color: p.text,
          }}
        >
          {tab}
        </div>
      </div>
      <div style={{ flex: 1, background: p.tab, display: "flex", alignItems: "center", padding: "0 16px", gap: 14 }}>
        <div style={{ color: "#888", fontSize: 18 }}>←&nbsp;&nbsp;→&nbsp;&nbsp;↻</div>
        <div
          style={{
            flex: 1,
            height: 32,
            borderRadius: 16,
            background: p.field,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: 15,
            color: p.text,
          }}
        >
          {url}
        </div>
      </div>
    </div>
    <div style={{ position: "relative", height: rect.h - CHROME_HEIGHT, borderTop: `1px solid ${p.line}` }}>{children}</div>
  </div>
  );
};
