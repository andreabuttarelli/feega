import { MONO, SANS } from "../theme";

const MENUS = ["Finder", "File", "Edit", "View", "Go", "Window", "Help"];
const MENU_HEIGHT = 34;

export enum App {
  Finder = "finder",
  Browser = "browser",
  Notes = "notes",
  Music = "music",
  Terminal = "terminal",
  Settings = "settings",
}

const ICONS: Record<App, { bg: string; glyph: string; color: string; font: string }> = {
  [App.Finder]: { bg: "linear-gradient(180deg,#6cc4ff,#1f7cf2)", glyph: "◐", color: "#fff", font: SANS },
  [App.Browser]: { bg: "radial-gradient(circle at 50% 50%,#fff 0 22%,#4285f4 23% 34%,#f2f2f2 35%)", glyph: "", color: "#fff", font: SANS },
  [App.Notes]: { bg: "linear-gradient(180deg,#ffd84d,#f5b400)", glyph: "≡", color: "#7a5a00", font: SANS },
  [App.Music]: { bg: "linear-gradient(180deg,#ff6b81,#e8304d)", glyph: "♪", color: "#fff", font: SANS },
  [App.Terminal]: { bg: "linear-gradient(180deg,#3a3a3c,#1c1c1e)", glyph: ">_", color: "#e5e5e5", font: MONO },
  [App.Settings]: { bg: "linear-gradient(180deg,#a7a7ad,#6d6d73)", glyph: "⚙", color: "#fff", font: SANS },
};

const DOCK_ORDER = [App.Finder, App.Browser, App.Notes, App.Music, App.Terminal, App.Settings];
const ICON = 76;
const ICON_GAP = 14;
const DOCK_PAD = 12;
const DOCK_BOTTOM = 14;

export const DOCK_TOP = 1080 - DOCK_BOTTOM - ICON - DOCK_PAD * 2;

export const dockIconCenter = (app: App) => {
  const width = DOCK_ORDER.length * ICON + (DOCK_ORDER.length - 1) * ICON_GAP;
  const index = DOCK_ORDER.indexOf(app);

  return { x: 960 - width / 2 + index * (ICON + ICON_GAP) + ICON / 2, y: DOCK_TOP + DOCK_PAD + ICON / 2 };
};

type Props = {
  opacity: number;
  bounce: Partial<Record<App, number>>;
  running: App[];
};

export const Desktop = ({ opacity, bounce, running }: Props) => (
  <div style={{ position: "absolute", inset: 0, opacity, fontFamily: SANS }}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at 20% 80%, #3b2a7a 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, #1d5c8f 0%, transparent 50%), radial-gradient(ellipse at 60% 90%, #8a3b6b 0%, transparent 45%), #0d1024",
      }}
    />

    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: MENU_HEIGHT,
        background: "rgba(20,20,30,0.35)",
        backdropFilter: "blur(20px)",
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

    <div
      style={{
        position: "absolute",
        left: "50%",
        top: DOCK_TOP,
        transform: "translateX(-50%)",
        padding: DOCK_PAD,
        display: "flex",
        gap: ICON_GAP,
        borderRadius: 26,
        background: "rgba(255,255,255,0.16)",
        border: "1px solid rgba(255,255,255,0.2)",
        backdropFilter: "blur(24px)",
      }}
    >
      {DOCK_ORDER.map((app) => {
        const icon = ICONS[app];

        return (
          <div key={app} style={{ position: "relative", transform: `translateY(${-(bounce[app] ?? 0) * 26}px)` }}>
            <div
              style={{
                width: ICON,
                height: ICON,
                borderRadius: 18,
                background: icon.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                fontWeight: 600,
                fontFamily: icon.font,
                color: icon.color,
                boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
              }}
            >
              {icon.glyph}
            </div>
            {running.includes(app) && (
              <div style={{ position: "absolute", left: ICON / 2 - 3, bottom: -9, width: 6, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.8)" }} />
            )}
          </div>
        );
      })}
    </div>
  </div>
);
