import type { ReactNode } from "react";
import { SANS } from "../theme";
import type { Rect } from "./Terminal";

type Props = {
  rect: Rect;
  url: string;
  tab: string;
  opacity: number;
  scale: number;
  children: ReactNode;
};

export const CHROME_HEIGHT = 92;

export const Browser = ({ rect, url, tab, opacity, scale, children }: Props) => (
  <div
    style={{
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      borderRadius: 16,
      overflow: "hidden",
      background: "#fff",
      boxShadow: "0 50px 140px rgba(0,0,0,0.65)",
      opacity,
      transform: `scale(${scale})`,
      fontFamily: SANS,
    }}
  >
    <div style={{ height: CHROME_HEIGHT, background: "#dfe1e5", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 44, display: "flex", alignItems: "flex-end", padding: "0 16px", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, paddingBottom: 14 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: "10px 10px 0 0",
            height: 34,
            width: 220,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            fontSize: 14,
            color: "#333",
          }}
        >
          {tab}
        </div>
      </div>
      <div style={{ flex: 1, background: "#fff", display: "flex", alignItems: "center", padding: "0 16px", gap: 14 }}>
        <div style={{ color: "#888", fontSize: 18 }}>←&nbsp;&nbsp;→&nbsp;&nbsp;↻</div>
        <div
          style={{
            flex: 1,
            height: 32,
            borderRadius: 16,
            background: "#f1f3f4",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: 15,
            color: "#444",
          }}
        >
          {url}
        </div>
      </div>
    </div>
    <div style={{ position: "relative", height: rect.h - CHROME_HEIGHT, borderTop: "1px solid #e5e5e5" }}>{children}</div>
  </div>
);
