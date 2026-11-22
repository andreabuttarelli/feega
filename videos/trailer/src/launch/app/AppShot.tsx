import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import type { Rect } from "../editor/layout";
import { DISPLAY, MONO, ORANGE, PAPER } from "../style";
import { APP, BAR_H, CARD_H, DROP, HEAD, HEAD_FONT, LEFT_W, PAD, PAGE, PAGE_PAD, PROPS_TOP, PROP_ROW, RIGHT_W, RIGHT_X, SWATCH_TOP, cardRect, swatchRect } from "./appLayout";

const WINDOW = "#131312";
const PANEL = "#1b1b19";
const RAISED = "#252522";
const LINE = "rgba(247,246,242,.08)";
const TEXT = PAPER;
const MUTED = "#8a8780";
const FAINT = "#5c5a55";
const PAGE_BG = "#f6efe6";
const PAGE_INK = "#2a1c12";
const SERIF = "Georgia, serif";
const RADIUS = 28;

export const SWATCHES = [PAGE_INK, ORANGE, "#004dff", "#1f9d55", "#c026d3"];

export enum LeftTab {
  Layers = "Layers",
  Library = "Library",
}

export const TEMPLATES = [
  { name: "Pricing", src: "pricing-light", pro: false },
  { name: "Bento", src: "bento-grid-dark", pro: true },
  { name: "Features", src: "features-grid-light", pro: false },
  { name: "FAQ", src: "faq-dark", pro: false },
  { name: "Blog", src: "blog-cards-light", pro: true },
  { name: "Compare", src: "comparison-table-light", pro: false },
  { name: "Changelog", src: "changelog-light", pro: false },
  { name: "Command", src: "command-palette-dark", pro: true },
];

const LAYERS = [
  { depth: 0, name: "header.bar" },
  { depth: 0, name: "section.hero" },
  { depth: 1, name: "span.tag" },
  { depth: 1, name: "h1.title", head: true },
  { depth: 1, name: "p.lead" },
  { depth: 1, name: "div.actions" },
  { depth: 0, name: "section.products" },
  { depth: 1, name: "article.card ×3" },
  { depth: 0, name: "footer" },
];

const PRODUCTS = ["Fig & cedar", "Smoke tea", "Orange wood"];

export type AppState = {
  left: LeftTab;
  hover: number;
  selected: number;
  headColor: string;
  inserted: number;
  pick: number;
  presses: { rect: Rect; amount: number }[];
};

export const APP_REST: AppState = { left: LeftTab.Layers, hover: 0, selected: 0, headColor: SWATCHES[0], inserted: 0, pick: -1, presses: [] };

export const pressAmount = (frame: number, at: number) => Math.max(0, 1 - Math.abs(frame - at) / 4);

const box = (r: Rect): CSSProperties => ({ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, boxSizing: "border-box" });

const pressOf = (state: AppState, r: Rect) => state.presses.find((p) => p.rect.x === r.x && p.rect.y === r.y)?.amount ?? 0;

const Pill = ({ active, children }: { active: boolean; children: ReactNode }) => (
  <span style={{ flex: 1, display: "grid", placeItems: "center", height: 44, borderRadius: 14, background: active ? RAISED : "transparent", color: active ? TEXT : MUTED, boxShadow: active ? `inset 0 0 0 1px ${LINE}` : undefined }}>{children}</span>
);

const TopBar = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: APP.w, height: BAR_H, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: `0 ${PAD}px`, boxSizing: "border-box", gap: 18 }}>
    <span style={{ width: 22, height: 22, background: ORANGE }} />
    <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em" }}>feega</span>
    <span style={{ margin: "0 auto", padding: "10px 26px", borderRadius: 14, background: PANEL, color: MUTED, fontFamily: MONO, fontSize: 18 }}>localhost:5173</span>
    <span style={{ padding: "10px 20px", borderRadius: 14, background: ORANGE, color: PAPER, fontSize: 19, fontWeight: 600 }}>Copy for agent</span>
  </div>
);

const Layers = ({ state }: { state: AppState }) => (
  <div style={{ position: "absolute", left: PAD, top: BAR_H + 108, width: LEFT_W - 2 * PAD }}>
    {LAYERS.map((layer) => {
      const on = layer.head ? Math.max(state.selected, state.hover * 0.5) : 0;

      return (
        <div key={layer.name} style={{ height: 50, display: "flex", alignItems: "center", gap: 12, paddingLeft: 16 + layer.depth * 26, borderRadius: 14, background: `rgba(255,81,0,${0.16 * on})`, color: on > 0.5 ? TEXT : MUTED, fontFamily: MONO, fontSize: 19 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${on > 0.5 ? ORANGE : FAINT}` }} />
          {layer.name}
        </div>
      );
    })}
  </div>
);

const Library = ({ state }: { state: AppState }) => (
  <>
    <div style={{ position: "absolute", left: PAD, top: BAR_H + 96, fontSize: 18, color: MUTED }}>Sections · free and premium</div>
    {TEMPLATES.map((t, i) => {
      const r = cardRect(i);
      const picked = state.pick === i;
      const press = pressOf(state, r);

      return (
        <div key={t.src} style={{ ...box(r), transform: `scale(${1 - 0.05 * press})` }}>
          <div style={{ position: "relative", height: CARD_H - 34, borderRadius: 16, overflow: "hidden", boxShadow: picked ? `0 0 0 3px ${ORANGE}` : `0 0 0 1px ${LINE}` }}>
            <Img src={staticFile(`templates/${t.src}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {t.pro ? <span style={{ position: "absolute", right: 8, top: 8, padding: "3px 9px", borderRadius: 8, background: "#0b0b0a", color: ORANGE, fontFamily: MONO, fontSize: 13 }}>PRO</span> : null}
          </div>
          <div style={{ marginTop: 9, fontSize: 18, color: picked ? TEXT : MUTED }}>{t.name}</div>
        </div>
      );
    })}
  </>
);

const LEFT_PANES: Record<LeftTab, (props: { state: AppState }) => ReactNode> = {
  [LeftTab.Layers]: Layers,
  [LeftTab.Library]: Library,
};

const LeftBar = ({ state }: { state: AppState }) => {
  const Pane = LEFT_PANES[state.left];

  return (
    <>
      <div style={{ position: "absolute", left: PAD, top: BAR_H + 24, width: LEFT_W - 2 * PAD, display: "flex", padding: 5, borderRadius: 18, background: PANEL, boxSizing: "border-box", fontSize: 19 }}>
        {Object.values(LeftTab).map((tab) => (
          <Pill key={tab} active={tab === state.left}>{tab}</Pill>
        ))}
      </div>
      <Pane state={state} />
    </>
  );
};

const Page = () => (
  <div style={{ ...box(PAGE), borderRadius: `${RADIUS}px ${RADIUS}px 0 0`, background: PAGE_BG, overflow: "hidden", color: PAGE_INK }}>
    <div style={{ display: "flex", justifyContent: "space-between", padding: `34px ${PAGE_PAD}px`, fontFamily: SERIF, fontSize: 22 }}>
      <b>Ostro</b>
      <span style={{ display: "flex", gap: 30, fontSize: 18, opacity: 0.6 }}>
        <span>Shop</span>
        <span>Journal</span>
        <span>About</span>
      </span>
    </div>
  </div>
);

const PageBody = ({ state }: { state: AppState }) => {
  const outline = Math.max(state.selected, state.hover);
  const below = DROP.h * state.inserted;

  return (
    <>
      <div style={{ ...box(HEAD), padding: "6px 12px", fontFamily: SERIF, fontSize: HEAD_FONT, lineHeight: 1, letterSpacing: "-0.03em", color: state.headColor, boxShadow: `0 0 0 ${outline > 0 ? 3 : 0}px rgba(255,81,0,${outline})` }}>
        Scent, slowly made.
        {state.selected > 0.5 ? <span style={{ position: "absolute", left: -3, top: -36, padding: "4px 10px", borderRadius: 8, background: ORANGE, color: PAPER, fontFamily: MONO, fontSize: 16, letterSpacing: 0 }}>h1.title</span> : null}
      </div>
      <div style={{ position: "absolute", left: HEAD.x + 12, top: HEAD.y + HEAD.h + 28, width: 520, fontFamily: SERIF, fontSize: 24, lineHeight: 1.4, color: PAGE_INK, opacity: 0.65 }}>Small-batch candles poured by hand in Milan, one season at a time.</div>
      <div style={{ ...box(DROP), height: below, borderRadius: 20, overflow: "hidden", opacity: state.inserted, boxShadow: `0 0 0 3px rgba(255,81,0,${state.inserted})` }}>
        <Img src={staticFile(`templates/${TEMPLATES[Math.max(state.pick, 0)].src}.webp`)} style={{ width: DROP.w, height: DROP.h, objectFit: "cover", display: "block" }} />
      </div>
      <div style={{ position: "absolute", left: DROP.x, top: DROP.y + below + (state.inserted > 0 ? 28 : 0), display: "flex", gap: 24 }}>
        {PRODUCTS.map((name, i) => (
          <div key={name} style={{ width: (DROP.w - 48) / 3 }}>
            <div style={{ height: 260, borderRadius: 20, background: ["#e9d8c4", "#d9c9b5", "#efc9a8"][i] }} />
            <div style={{ marginTop: 14, fontFamily: SERIF, fontSize: 22, color: PAGE_INK }}>{name}</div>
          </div>
        ))}
      </div>
    </>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div style={{ height: PROP_ROW, display: "flex", alignItems: "center", gap: 16 }}>
    <span style={{ width: 92, color: MUTED, fontSize: 19 }}>{label}</span>
    <span style={{ flex: 1, height: 52, borderRadius: 14, background: PANEL, display: "flex", alignItems: "center", padding: "0 18px", fontFamily: MONO, fontSize: 19, color: TEXT }}>{value}</span>
  </div>
);

const RightBar = ({ state }: { state: AppState }) => (
  <div style={{ position: "absolute", left: RIGHT_X, top: BAR_H, width: RIGHT_W, height: APP.h - BAR_H, borderLeft: `1px solid ${LINE}`, boxSizing: "border-box" }}>
    <div style={{ position: "absolute", left: PAD, right: PAD, top: 30, display: "flex", alignItems: "center", gap: 12, fontSize: 21 }}>
      <span style={{ fontWeight: 600 }}>Properties</span>
      <span style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 10, background: state.selected > 0.5 ? "rgba(255,81,0,.16)" : PANEL, color: state.selected > 0.5 ? ORANGE : FAINT, fontFamily: MONO, fontSize: 17 }}>{state.selected > 0.5 ? "h1.title" : "nothing selected"}</span>
    </div>
    <div style={{ position: "absolute", left: PAD, right: PAD, top: PROPS_TOP - BAR_H - 44, fontSize: 16, letterSpacing: "0.08em", color: FAINT }}>TYPOGRAPHY</div>
    <div style={{ position: "absolute", left: PAD, right: PAD, top: PROPS_TOP - BAR_H }}>
      <Field label="Font" value="Georgia" />
      <Field label="Size" value={`${HEAD_FONT} px`} />
      <Field label="Colour" value={state.headColor} />
    </div>
    <div style={{ position: "absolute", left: PAD, right: PAD, top: SWATCH_TOP - BAR_H + 112, fontSize: 16, letterSpacing: "0.08em", color: FAINT }}>SPACING</div>
    <div style={{ position: "absolute", left: PAD, right: PAD, top: SWATCH_TOP - BAR_H + 136 }}>
      <Field label="Padding" value="0 px" />
      <Field label="Margin" value="0 0 28 px" />
      <Field label="Opacity" value="100 %" />
    </div>
  </div>
);

const Swatches = ({ state }: { state: AppState }) => (
  <>
    {SWATCHES.map((c, i) => {
      const r = swatchRect(i);
      const on = state.headColor === c;

      return <div key={c} style={{ ...box(r), borderRadius: 16, background: c, boxShadow: on ? `0 0 0 3px ${WINDOW}, 0 0 0 6px ${TEXT}` : `inset 0 0 0 1px ${LINE}`, transform: `scale(${1 - 0.12 * pressOf(state, r)})` }} />;
    })}
  </>
);

export const AppShot = ({ state }: { state: AppState }) => (
  <div style={{ position: "relative", width: APP.w, height: APP.h, borderRadius: RADIUS + 8, background: WINDOW, color: TEXT, fontFamily: DISPLAY, overflow: "hidden", boxShadow: `0 0 0 1px ${LINE}, 0 50px 120px rgba(0,0,0,.35)` }}>
    <TopBar />
    <LeftBar state={state} />
    <Page />
    <PageBody state={state} />
    <RightBar state={state} />
    <Swatches state={state} />
  </div>
);
