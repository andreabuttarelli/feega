import type { ReactNode } from "react";
import { SANS } from "../theme";
import { FeegaMark, Mark, MARKS, VSCODE_BLUE } from "./brandIcons";

const MENUS = ["Finder", "File", "Edit", "View", "Go", "Window", "Help"];
const MENU_HEIGHT = 34;

export enum App {
  Files = "files",
  X = "x",
  Feega = "feega",
  VSCode = "vscode",
  Cursor = "cursor",
  Grok = "grok",
  Notes = "notes",
  Settings = "settings",
}

const ICON = 76;
const MARK = ICON * 0.56;
const TILE_RADIUS = ICON * 0.225;

const Glyph = ({ children, color }: { children: ReactNode; color: string }) => (
  <span style={{ fontSize: 38, fontWeight: 600, color, fontFamily: SANS }}>{children}</span>
);

const TILES: Record<App, { bg: string; mark: ReactNode }> = {
  [App.Files]: { bg: "linear-gradient(180deg,#8fd0ff,#2a86f0)", mark: <Glyph color="#fff">▭</Glyph> },
  [App.X]: { bg: "#000", mark: <Mark mark={MARKS.x} size={MARK * 0.86} color="#fff" /> },
  [App.Feega]: { bg: "#fff", mark: <FeegaMark size={MARK} /> },
  [App.VSCode]: { bg: "#fff", mark: <Mark mark={MARKS.vscode} size={MARK} color={VSCODE_BLUE} /> },
  [App.Cursor]: { bg: "#0b0b0b", mark: <Mark mark={MARKS.cursor} size={MARK} color="#fff" /> },
  [App.Grok]: { bg: "#000", mark: <Mark mark={MARKS.grok} size={MARK} color="#fff" /> },
  [App.Notes]: { bg: "linear-gradient(180deg,#ffe27a,#f6be1d)", mark: <Glyph color="#8a6400">≡</Glyph> },
  [App.Settings]: { bg: "linear-gradient(180deg,#b9b9bf,#76767c)", mark: <Glyph color="#fff">◎</Glyph> },
};

const DOCK_ORDER = [App.Files, App.X, App.Feega, App.VSCode, App.Cursor, App.Grok, App.Notes, App.Settings];
const ICON_GAP = 14;
const DOCK_PAD = 12;
const DOCK_BOTTOM = 14;
const DOCK_RADIUS = 26;
const MAGNIFY = 0.95;
const REACH = 130;
const BOUNCE = 30;

export const DOCK_TOP = 1080 - DOCK_BOTTOM - ICON - DOCK_PAD * 2;
export const DOCK_BASE = 1080 - DOCK_BOTTOM - DOCK_PAD;

const SPAN = ICON + ICON_GAP;

const restCenter = (index: number) => 960 + (index - (DOCK_ORDER.length - 1) / 2) * SPAN;

export type Pointer = { x: number; hover: number };

type Slot = { app: App; x: number; scale: number };

export const dockLayout = (pointer: Pointer): Slot[] => {
  const scales = DOCK_ORDER.map((_, i) => 1 + MAGNIFY * pointer.hover * Math.exp(-(((restCenter(i) - pointer.x) / REACH) ** 2)));
  const widths = scales.map((s) => s * ICON);
  const total = widths.reduce((a, b) => a + b, 0) + ICON_GAP * (DOCK_ORDER.length - 1);

  let left = 960 - total / 2;

  return DOCK_ORDER.map((app, i) => {
    const x = left + widths[i] / 2;
    left += widths[i] + ICON_GAP;

    return { app, x, scale: scales[i] };
  });
};

export const dockIconCenter = (app: App, pointer: Pointer) => {
  const slot = dockLayout(pointer).find((s) => s.app === app)!;

  return { x: slot.x, y: DOCK_BASE - (slot.scale * ICON) / 2 };
};

type Props = {
  opacity: number;
  pointer: Pointer;
  bounce: Partial<Record<App, number>>;
  running: App[];
};

const Wallpaper = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(ellipse at 20% 80%, #3b2a7a 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, #1d5c8f 0%, transparent 50%), radial-gradient(ellipse at 60% 90%, #8a3b6b 0%, transparent 45%), #0d1024",
    }}
  />
);

const MenuBar = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: MENU_HEIGHT,
      background: "rgba(20,20,30,0.35)",
      display: "flex",
      alignItems: "center",
      padding: "0 22px",
      gap: 24,
      fontSize: 16,
      color: "rgba(255,255,255,0.92)",
    }}
  >
    {MENUS.map((m, i) => (
      <span key={m} style={{ fontWeight: i === 0 ? 700 : 400 }}>
        {m}
      </span>
    ))}
    <span style={{ marginLeft: "auto" }}>Sun 22 Nov 9:41</span>
  </div>
);

const Tile = ({ app }: { app: App }) => (
  <div
    style={{
      width: ICON,
      height: ICON,
      borderRadius: TILE_RADIUS,
      background: TILES[app].bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)",
    }}
  >
    {TILES[app].mark}
  </div>
);

export const Desktop = ({ opacity, pointer, bounce, running }: Props) => {
  const slots = dockLayout(pointer);
  const left = slots[0].x - (slots[0].scale * ICON) / 2 - DOCK_PAD;
  const last = slots[slots.length - 1];
  const right = last.x + (last.scale * ICON) / 2 + DOCK_PAD;

  return (
    <div style={{ position: "absolute", inset: 0, opacity, fontFamily: SANS }}>
      <Wallpaper />
      <MenuBar />

      <div
        style={{
          position: "absolute",
          left: 0,
          width: 1920,
          top: DOCK_TOP,
          height: ICON + DOCK_PAD * 2,
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.2)",
          boxSizing: "border-box",
          clipPath: `inset(0 ${1920 - right}px 0 ${left}px round ${DOCK_RADIUS}px)`,
        }}
      />

      {slots.map((slot) => (
        <div key={slot.app}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: DOCK_BASE - ICON,
              transformOrigin: `${ICON / 2}px ${ICON}px`,
              transform: `translate(${slot.x - ICON / 2}px, ${-(bounce[slot.app] ?? 0) * BOUNCE}px) scale(${slot.scale})`,
            }}
          >
            <Tile app={slot.app} />
          </div>
          {running.includes(slot.app) && (
            <div style={{ position: "absolute", left: slot.x - 3, top: DOCK_BASE + 4, width: 6, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.85)" }} />
          )}
        </div>
      ))}
    </div>
  );
};
