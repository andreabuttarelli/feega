import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { FeegaMark } from "../../components/brandIcons";
import { GLYPH, LAYER, type Glyph, type LayerGlyph } from "./glyphs";
import {
  BASE_FONT, BODY_Y, Control, EDITING_H, H1_LEFT, H1_TOP, H1_W, H1_X, HEAD_H, LABEL_W, LAYERS_TOP, LAYER_ROW, LEFT_W, LIBRARY_TOP, MESH_BOX, MESH_PROPS,
  PAGE, POPOVER, RIGHT_W, RIGHT_X, ROW_H, SCOPE_H, SIDE_PAD, STATE_Y, TABS, TEXT_PROPS, TOP_ROW, Tab, WHAT_H, WIN, h1Rect, insertY,
  libraryRect, placeProps, swatchRect, type PlacedRow, type Rect,
} from "./layout";

const ACCENT = "#0a84ff";
const PANEL = "#181818";
const TEXT = "#e4e4e4";
const TEXT_2 = "#9c9c9c";
const TEXT_3 = "#6f6f6f";
const DIVIDER = "#2f2f2f";
const INPUT = "#282828";
const THUMB = "#5b5a5f";
const PICKED = "#132e4a";
const ALIGNED = "alignCenter";
const BACKDROP = "#262626";
const LINK = "#3794ff";
const DANGER = "#f14c4c";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const CODE = '"Fragment Mono", "SF Mono", Menlo, monospace';
const PAGE_BG = "#f5f6fb";
const PAGE_INK = "#14142b";
const PAGE_MUTED = "#4b4b63";
const PAGE_ACCENT = "#4f46e5";
const PAGE_SOFT = "#e9ebfa";
const PAGE_FONT = '"BDO Grotesk", "Inter Tight", -apple-system, sans-serif';
const AGENT = "#d97757";

export const SWATCHES = ["#14142b", "#ff5100", "#004dff", "#1f9d55", "#c026d3"];

export enum LeftPanel {
  Layers = "Layers",
  Library = "Library",
}

export const LIBRARY = [
  { name: "Pricing", src: "pricing-light", live: true },
  { name: "Bento grid", src: "bento-grid-dark", live: false },
  { name: "Features", src: "features-grid-light", live: false },
  { name: "FAQ", src: "faq-dark", live: false },
  { name: "Blog cards", src: "blog-cards-light", live: false },
  { name: "Comparison", src: "comparison-table-light", live: false },
];

type Layer = { depth: number; open?: boolean; icon: LayerGlyph; name: string; count?: string; h1?: boolean; fresh?: boolean };

const LAYERS: Layer[] = [
  { depth: 0, open: true, icon: "block", name: "html" },
  { depth: 1, open: true, icon: "flexColumn", name: "body" },
  { depth: 2, open: false, icon: "header", name: "header.fl-navbar" },
  { depth: 2, open: true, icon: "block", name: "section.fl-hero" },
  { depth: 3, open: true, icon: "flexColumn", name: "div.fl-container" },
  { depth: 4, icon: "text", name: "p.fl-eyebrow" },
  { depth: 4, icon: "h1", name: "h1.title", h1: true },
  { depth: 4, icon: "text", name: "p.fl-lead" },
  { depth: 4, open: false, icon: "flexRow", name: "div.cta" },
  { depth: 2, open: false, icon: "grid", name: "section.fl-pricing", fresh: true },
  { depth: 2, open: false, icon: "block", name: "section.fl-live-preview" },
  { depth: 2, open: false, icon: "block", name: "section.fl-bento-grid" },
  { depth: 2, open: false, icon: "footer", name: "footer" },
];

enum Diff {
  Same = "same",
  Removed = "removed",
  Added = "added",
}

const DIFF_STYLE: Record<Diff, { sign: string; bg: string; fg: string }> = {
  [Diff.Same]: { sign: " ", bg: "transparent", fg: TEXT_2 },
  [Diff.Removed]: { sign: "−", bg: "rgba(255,90,90,.13)", fg: "#ff9a9a" },
  [Diff.Added]: { sign: "+", bg: "rgba(80,220,140,.13)", fg: "#8fe8b4" },
};

const DIFF_LINES: { kind: Diff; text: string; n: number }[] = [
  { kind: Diff.Same, text: '<section class="hero">', n: 12 },
  { kind: Diff.Removed, text: '  <h1 class="text-[64px]', n: 14 },
  { kind: Diff.Removed, text: '      text-[#14142b]">', n: 15 },
  { kind: Diff.Added, text: '  <h1 class="text-[76px]', n: 14 },
  { kind: Diff.Added, text: '      text-[#ff5100]">', n: 15 },
  { kind: Diff.Same, text: "    see every deploy", n: 16 },
];

const CHANGES = [
  { prop: "color", value: "#ff5100" },
  { prop: "font-size", value: "76px" },
];

export const DIFF_COUNT = DIFF_LINES.length;

const PLANS = [
  { name: "Hobby", price: "$0", note: "one project, 7-day history" },
  { name: "Pro", price: "$24", note: "unlimited deploys, alerts" },
  { name: "Team", price: "$80", note: "SSO, audit log, 90 days" },
];

export type MeshPoint = { x: number; y: number; c: string };

export type Insert = { pick: number; drop: number; inserted: number };

export type EditorState = {
  tab: Tab;
  left: LeftPanel;
  hover: number;
  selected: number;
  fontSize: number;
  headColor: string;
  scrub: boolean;
  swatches: number;
  changes: number;
  saved: number;
  library: Insert | null;
  agent: number;
  agentGlow: number;
  mesh: MeshPoint[] | null;
  presses: { rect: Rect; amount: number }[];
};

export const EDITOR_REST: EditorState = {
  tab: Tab.Properties,
  left: LeftPanel.Layers,
  hover: 0,
  selected: 0,
  fontSize: BASE_FONT,
  headColor: SWATCHES[0],
  scrub: false,
  swatches: 0,
  changes: 0,
  saved: 0,
  library: null,
  agent: 0,
  agentGlow: 0,
  mesh: null,
  presses: [],
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const PRICING_PAD = 26;
const PRICING_HEAD = 58;
const PRICING_W = PAGE.w - 2 * H1_LEFT;
const CARD_GAP = 14;
const TWO_COL = { cols: 2, h: 92 };
const THREE_COL = { cols: 3, h: 124 };

const layoutOf = (shape: { cols: number; h: number }, i: number): Rect => {
  const w = (PRICING_W - CARD_GAP * (shape.cols - 1)) / shape.cols;
  return { x: (i % shape.cols) * (w + CARD_GAP), y: Math.floor(i / shape.cols) * (shape.h + CARD_GAP), w, h: shape.h };
};

const rowsOf = (shape: { cols: number; h: number }) => Math.ceil(PLANS.length / shape.cols);
const gridHeight = (shape: { cols: number; h: number }) => rowsOf(shape) * shape.h + (rowsOf(shape) - 1) * CARD_GAP;

export const pricingHeight = (agent: number) => PRICING_PAD + PRICING_HEAD + mix(gridHeight(TWO_COL), gridHeight(THREE_COL), agent) + PRICING_PAD;

export const pricingRect = (fontSize: number, agent: number): Rect => ({ x: PAGE.x + H1_LEFT - 12, y: insertY(fontSize), w: PRICING_W + 24, h: pricingHeight(agent) });

const Ico = ({ name, size = 14 }: { name: Glyph; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: GLYPH[name] }} />
);

const LayerIco = ({ name }: { name: LayerGlyph }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", color: "#8a8a8a" }} dangerouslySetInnerHTML={{ __html: LAYER[name] }} />
);

const box = (r: Rect): CSSProperties => ({ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h });

const IconButton = ({ name, on, dim }: { name: Glyph; on?: boolean; dim?: boolean }) => (
  <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 4, background: on ? INPUT : "transparent", color: on ? TEXT : TEXT_2, opacity: dim ? 0.35 : 1, flex: "none" }}>
    <Ico name={name} size={15} />
  </span>
);

const Field = ({ prefix, value, unit, active }: { prefix: string; value: string; unit: string; active?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", height: 28, borderRadius: 4, background: active ? "#33363d" : INPUT, boxShadow: active ? `0 0 0 1.5px ${ACCENT}` : "none", minWidth: 0, flex: 1 }}>
    <span style={{ minWidth: 20, textAlign: "center", color: TEXT_3, fontSize: 11 }}>{prefix}</span>
    <span style={{ flex: 1, color: TEXT, fontSize: 12.5, fontVariantNumeric: "tabular-nums", overflow: "hidden", whiteSpace: "nowrap" }}>{value}</span>
    <span style={{ display: "flex", alignItems: "center", gap: 2, color: TEXT_3, fontSize: 11, paddingRight: 6 }}>
      {unit}
      {unit ? <Ico name="chevronDown" size={9} /> : null}
    </span>
  </div>
);

const PanelHead = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div style={{ height: TOP_ROW, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: `1px solid ${DIVIDER}`, color: TEXT_2, fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}>
    {title}
    {children}
  </div>
);

const layerRows = (state: EditorState) => LAYERS.filter((row) => !row.fresh || (state.library?.inserted ?? 0) > 0);

const Layers = ({ state }: { state: EditorState }) => {
  const fresh = state.library?.inserted ?? 0;

  return (
    <div>
      <PanelHead title="Layers">
        <span style={{ display: "flex", alignItems: "center", gap: 3, height: 18, padding: "0 7px", borderRadius: 4, background: "#cdcdcd", color: "#141414", fontSize: 12, fontWeight: 600 }}>
          <Ico name="plus" size={10} />
          Add
        </span>
      </PanelHead>
      <div style={{ position: "absolute", top: LAYERS_TOP, left: 0, right: 0 }}>
        {layerRows(state).map((row) => {
          const picked = (row.h1 && state.selected > 0.5 && fresh === 0) || (row.fresh && fresh > 0.5);
          const height = row.fresh ? LAYER_ROW * fresh : LAYER_ROW;

          return (
            <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 4, height, overflow: "hidden", paddingLeft: 8 + row.depth * 11, paddingRight: 8, fontSize: 12.5, color: TEXT, opacity: row.fresh ? fresh : 1, background: picked ? PICKED : row.h1 && state.hover > 0.5 ? "rgba(255,255,255,.05)" : "transparent", boxShadow: row.fresh && state.agentGlow > 0 ? `inset 2px 0 0 ${AGENT}` : "none" }}>
              <span style={{ width: 14, display: "grid", placeItems: "center", color: TEXT_3, transform: row.open ? "rotate(90deg)" : "none" }}>
                {row.open === undefined ? null : <Ico name="chevronRight" size={12} />}
              </span>
              <LayerIco name={row.icon} />
              <span>{row.name}</span>
              {row.count ? <span style={{ marginLeft: "auto", color: TEXT_3, fontSize: 11 }}>{row.count}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LibraryPanel = ({ state }: { state: EditorState }) => (
  <div>
    <PanelHead title="Library">
      <span style={{ color: TEXT_2, display: "grid" }}>
        <Ico name="x" size={13} />
      </span>
    </PanelHead>
    <div style={{ position: "absolute", left: SIDE_PAD, right: SIDE_PAD, top: BODY_Y + 10, display: "flex", gap: 6 }}>
      <span style={{ flex: 1, height: 26, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderRadius: 4, background: INPUT, color: TEXT_3, fontSize: 12 }}>
        <Ico name="search" size={12} />
        Search
      </span>
      <span style={{ display: "flex", padding: 2, borderRadius: 4, background: INPUT, fontSize: 11 }}>
        {["light", "dark"].map((t, i) => (
          <span key={t} style={{ display: "grid", placeItems: "center", padding: "0 7px", borderRadius: 3, background: i === 0 ? THUMB : "transparent", color: i === 0 ? "#fff" : TEXT_2 }}>{t}</span>
        ))}
      </span>
    </div>
    <div style={{ position: "absolute", left: SIDE_PAD, right: SIDE_PAD, top: BODY_Y + 48, display: "flex", gap: 14, fontSize: 12, borderBottom: `1px solid ${DIVIDER}` }}>
      {["Sections", "Components", "App"].map((t, i) => (
        <span key={t} style={{ padding: "6px 0 8px", color: i === 0 ? TEXT : TEXT_2, boxShadow: i === 0 ? `inset 0 -2px 0 ${TEXT}` : "none" }}>{t}</span>
      ))}
    </div>
    {LIBRARY.map((item, i) => {
      const r = libraryRect(i);
      const lifted = state.library?.pick === i && state.library.inserted === 0 ? state.library.drop : 0;

      return (
        <div key={item.name} style={{ ...box(r) }}>
          <div style={{ height: r.h - 30, borderRadius: 6, overflow: "hidden", background: "#fff", boxShadow: lifted > 0 ? `0 0 0 2px ${ACCENT}` : `0 0 0 1px ${DIVIDER}`, opacity: 1 - 0.5 * lifted }}>
            {item.live ? <PricingThumb width={r.w} /> : <Img src={staticFile(`templates/${item.src}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: TEXT_2 }}>
            {item.name}
            <span style={{ padding: "2px 7px", borderRadius: 4, background: "#d4d4d4", color: "#1e1e1e", fontWeight: 600, fontSize: 10 }}>Insert</span>
          </div>
        </div>
      );
    })}
  </div>
);

const LEFT_PANES: Record<LeftPanel, (props: { state: EditorState }) => ReactNode> = {
  [LeftPanel.Layers]: Layers,
  [LeftPanel.Library]: LibraryPanel,
};

const LeftBar = ({ state }: { state: EditorState }) => {
  const Pane = LEFT_PANES[state.left];

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: LEFT_W, height: WIN.h, background: PANEL, borderRight: `1px solid ${DIVIDER}`, boxSizing: "border-box" }}>
      <Pane state={state} />
    </div>
  );
};

const Toolbar = () => (
  <div style={{ position: "absolute", left: LEFT_W, top: 0, width: PAGE.w, height: TOP_ROW, background: PANEL, borderBottom: `1px solid ${DIVIDER}`, display: "flex", alignItems: "center", gap: 4, padding: "0 8px", boxSizing: "border-box" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 4px", color: TEXT_2 }}>
      <FeegaMark size={16} />
      <Ico name="chevronDown" size={11} />
    </span>
    <IconButton name="panelLeft" on />
    <IconButton name="arrowLeft" dim />
    <IconButton name="arrowRight" dim />
    <IconButton name="reload" />
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 10px", borderRadius: 999, background: INPUT, fontSize: 12, color: TEXT, minWidth: 0 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: "#30d158", flex: "none" }} />/
    </div>
    <div style={{ display: "flex", alignItems: "center", padding: 2, borderRadius: 4, background: INPUT }}>
      {(["full", "desktop", "tablet", "phone"] as Glyph[]).map((d, i) => (
        <span key={d} style={{ display: "grid", placeItems: "center", width: 22, height: 20, borderRadius: 2, color: i === 0 ? TEXT : TEXT_2, background: i === 0 ? "#232323" : "transparent", boxShadow: i === 0 ? `0 0 0 1px ${DIVIDER}` : "none" }}>
          <Ico name={d} size={13} />
        </span>
      ))}
    </div>
    <span style={{ height: 24, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", borderRadius: 4, background: INPUT, color: TEXT_2, fontSize: 12 }}>
      <span style={{ color: TEXT }}>720</span>× 860
    </span>
    <span style={{ height: 24, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", borderRadius: 4, background: INPUT, color: TEXT_2, fontSize: 12 }}>
      <Ico name="theme" size={12} />
      Theme
      <Ico name="chevronDown" size={10} />
    </span>
    <IconButton name="external" />
    <IconButton name="panelRight" on />
  </div>
);

const PricingSection = ({ agent, glow }: { agent: number; glow: number }) => (
  <div style={{ position: "relative", height: pricingHeight(agent), padding: `${PRICING_PAD}px ${H1_LEFT}px`, boxSizing: "border-box", background: "#ffffff" }}>
    <div style={{ fontSize: 10, letterSpacing: "0.12em", color: PAGE_ACCENT, fontFamily: CODE }}>■ PRICING</div>
    <div style={{ fontFamily: PAGE_FONT, fontSize: 28, letterSpacing: "-0.02em", marginTop: 6 }}>pay for calm, not seats.</div>
    <div style={{ position: "absolute", left: H1_LEFT, top: PRICING_PAD + PRICING_HEAD, width: PRICING_W }}>
      {PLANS.map((plan, i) => {
        const a = layoutOf(TWO_COL, i);
        const b = layoutOf(THREE_COL, i);
        const r = { x: mix(a.x, b.x, agent), y: mix(a.y, b.y, agent), w: mix(a.w, b.w, agent), h: mix(a.h, b.h, agent) };
        const pro = i === 1 ? agent : 0;

        return (
          <div key={plan.name} style={{ ...box(r), borderRadius: 12, padding: "14px 16px", boxSizing: "border-box", fontSize: 12, background: pro > 0.5 ? PAGE_INK : PAGE_SOFT, color: pro > 0.5 ? "#fff" : PAGE_INK, boxShadow: pro > 0 ? `0 ${10 * pro}px ${24 * pro}px rgba(20,20,43,${0.25 * pro})` : "none", transform: `translateY(${-6 * pro}px)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontWeight: 600 }}>{plan.name}</b>
              {i === 1 ? <span style={{ padding: "2px 8px", borderRadius: 999, background: PAGE_ACCENT, color: "#fff", fontSize: 10, opacity: pro, transform: `scale(${0.6 + 0.4 * pro})` }}>popular</span> : null}
            </div>
            <div style={{ fontFamily: PAGE_FONT, fontSize: 28, marginTop: 4 }}>{plan.price}</div>
            <div style={{ opacity: 0.7, marginTop: 2 }}>{plan.note}</div>
          </div>
        );
      })}
    </div>
    {glow > 0 ? <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 2px rgba(217,119,87,${glow})`, background: `rgba(217,119,87,${0.06 * glow})` }} /> : null}
  </div>
);

const PricingThumb = ({ width }: { width: number }) => {
  const scale = width / PAGE.w;

  return (
    <div style={{ width: PAGE.w, transform: `scale(${scale})`, transformOrigin: "0 0", color: PAGE_INK, fontFamily: FONT }}>
      <PricingSection agent={0} glow={0} />
    </div>
  );
};

const Mesh = ({ points }: { points: MeshPoint[] }) => {
  const r = { x: MESH_BOX.x - PAGE.x, y: MESH_BOX.y - PAGE.y, w: MESH_BOX.w, h: MESH_BOX.h };
  const background = points.map((p) => `radial-gradient(circle at ${p.x}px ${p.y}px, ${p.c} 0, transparent 62%)`).join(", ");

  return (
    <div style={{ ...box(r), borderRadius: 14, background: `${background}, #f5f6fb`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 36, top: 120, fontFamily: PAGE_FONT, fontSize: 64, fontWeight: 620, color: "#fff", letterSpacing: "-0.055em", lineHeight: 1 }}>ship calmer.</div>
      <div style={{ position: "absolute", left: 38, top: 192, fontSize: 14, color: "rgba(255,255,255,.85)" }}>hero background · mesh gradient</div>
      <div style={{ position: "absolute", inset: 0, outline: `2px solid ${ACCENT}`, outlineOffset: -2, borderRadius: 14 }} />
      {points.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x - 10, top: p.y - 10, width: 20, height: 20, borderRadius: 10, background: p.c, border: "3px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.25), 0 2px 6px rgba(0,0,0,.3)" }} />
      ))}
    </div>
  );
};

const BARS = [22, 30, 26, 38, 34, 46, 52, 64, 80];

const LivePreview = () => (
  <div style={{ position: "relative", margin: `24px ${H1_LEFT}px 0`, height: 330, borderRadius: 14, background: `radial-gradient(#c9cdea 1px, transparent 1.2px) 0 0 / 14px 14px, #eef0fb`, boxShadow: "inset 0 0 0 1px #e1e4f4" }}>
    <span style={{ position: "absolute", right: 14, top: 12, fontFamily: CODE, fontSize: 9, letterSpacing: "0.1em", color: PAGE_MUTED }}>LIVE PREVIEW</span>
    <div style={{ position: "absolute", left: 34, right: 34, top: 34, bottom: -40, borderRadius: 10, background: "#fff", boxShadow: "0 10px 30px rgba(20,20,43,.08), 0 0 0 1px #e6e8f3", overflow: "hidden" }}>
      <div style={{ height: 30, display: "flex", alignItems: "center", gap: 5, padding: "0 12px", borderBottom: "1px solid #eceef6" }}>
        {[0, 1, 2].map((i) => (
          <i key={i} style={{ width: 7, height: 7, borderRadius: 4, background: "#d6d9ec" }} />
        ))}
        <span style={{ flex: 1, textAlign: "center", fontFamily: CODE, fontSize: 9.5, color: PAGE_MUTED, marginRight: 30 }}>app.lumen.dev</span>
      </div>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ width: 150, borderRight: "1px solid #eceef6", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
          <i style={{ width: 70, height: 7, borderRadius: 2, background: PAGE_ACCENT }} />
          {[0, 1, 2, 3].map((i) => (
            <i key={i} style={{ height: 7, borderRadius: 2, background: "#eceefa" }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: "18px 22px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <i style={{ width: 170, height: 14, borderRadius: 2, background: PAGE_INK }} />
            <i style={{ width: 60, height: 16, borderRadius: 8, background: PAGE_ACCENT }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {[0, 1, 2].map((i) => (
              <i key={i} style={{ flex: 1, height: 48, borderRadius: 6, background: "#eceefa" }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 22, right: 22, top: 130, display: "flex", alignItems: "flex-end", gap: 5, height: 90 }}>
            {BARS.map((h, i) => (
              <i key={i} style={{ flex: 1, height: h, background: i === BARS.length - 1 ? PAGE_ACCENT : "#c7cbee" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Hero = ({ state }: { state: EditorState }) => {
  const below = H1_TOP + state.fontSize * 2;
  const inserted = state.library?.inserted ?? 0;

  return (
    <>
      <span style={{ position: "absolute", left: 0, right: 0, top: H1_TOP - 36, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontFamily: CODE, fontSize: 11, letterSpacing: "0.12em", color: PAGE_MUTED }}>
        <i style={{ width: 6, height: 6, background: PAGE_ACCENT }} />
        RELEASE MONITORING
      </span>
      <div style={{ position: "absolute", left: H1_X, top: H1_TOP, width: H1_W, textAlign: "center", fontFamily: PAGE_FONT, fontSize: state.fontSize, fontWeight: 620, letterSpacing: "-0.055em", lineHeight: 0.98, color: state.headColor, whiteSpace: "nowrap" }}>
        see every deploy
        <br />
        before users do
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: below + 18, textAlign: "center" }}>
        <p style={{ margin: "0 auto", maxWidth: 470, color: PAGE_MUTED, fontSize: 14.5, lineHeight: "21px", letterSpacing: "-0.01em" }}>Lumen watches builds, traces and rollouts in one view, so a bad release never reaches Friday.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20, fontSize: 14, fontWeight: 500, letterSpacing: "-0.02em" }}>
          <span style={{ padding: "11px 22px", borderRadius: 999, background: PAGE_ACCENT, color: "#fff" }}>start free</span>
          <span style={{ padding: "11px 22px", borderRadius: 999, background: "#fff", boxShadow: "inset 0 0 0 1px #d4d6e4", color: PAGE_INK }}>take the tour →</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: insertY(state.fontSize) - PAGE.y }}>
        <div style={{ height: pricingHeight(state.agent) * inserted, overflow: "hidden", opacity: inserted }}>
          {state.library ? <PricingSection agent={state.agent} glow={state.agentGlow} /> : null}
        </div>
        <LivePreview />
      </div>
    </>
  );
};

const DropLine = ({ state }: { state: EditorState }) => {
  const drop = state.library?.drop ?? 0;

  if (drop <= 0 || (state.library?.inserted ?? 0) > 0) {
    return null;
  }

  const y = insertY(state.fontSize) - PAGE.y;

  return (
    <>
      <div style={{ position: "absolute", left: H1_LEFT - 12, top: y - 1, width: (PRICING_W + 24) * drop, height: 2, background: ACCENT }} />
      <span style={{ position: "absolute", left: H1_LEFT - 12, top: y - 20, padding: "0 5px", borderRadius: 2, background: ACCENT, color: "#fff", fontSize: 10, lineHeight: "16px", fontFamily: FONT, opacity: drop }}>after div.actions</span>
    </>
  );
};

const ModeBar = ({ state }: { state: EditorState }) => (
  <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 10, background: "rgba(24,24,24,.94)", boxShadow: `0 0 0 1px ${DIVIDER}, 0 8px 24px rgba(0,0,0,.22)`, fontSize: 12, color: TEXT }}>
    <span style={{ color: TEXT_3, display: "grid", padding: "0 2px" }}>
      <Ico name="grip" size={14} />
    </span>
    <span style={{ display: "flex", alignItems: "center", gap: 6, height: 28, width: 92, justifyContent: "center", borderRadius: 999, background: THUMB, color: "#fff" }}>
      <Ico name="design" />
      Design
    </span>
    <span style={{ display: "flex", alignItems: "center", gap: 6, height: 28, width: 92, justifyContent: "center", color: TEXT_2 }}>
      <Ico name="hand" />
      Navigate
    </span>
    <IconButton name="undo" dim={state.changes === 0 && state.saved === 0} />
    <IconButton name="redo" dim />
  </div>
);

const Toast = ({ saved }: { saved: number }) =>
  saved > 0 ? (
    <span style={{ position: "absolute", left: 12, bottom: 14, padding: "5px 10px", borderRadius: 4, background: "#1f1f1f", boxShadow: `0 0 0 1px ${DIVIDER}`, color: LINK, fontSize: 12, opacity: saved, transform: `translateY(${(1 - saved) * 10}px)` }}>Saved to Hero.svelte:14</span>
  ) : null;

const Preview = ({ state }: { state: EditorState }) => {
  const h1 = h1Rect(state.fontSize);

  return (
    <div style={{ ...box(PAGE), background: BACKDROP, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: PAGE_BG, color: PAGE_INK, fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `16px 28px`, fontSize: 14, letterSpacing: "-0.03em" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: PAGE_FONT, fontSize: 18, fontWeight: 650, letterSpacing: "-0.04em" }}>
            <svg width={16} height={16} viewBox="0 0 8 8" shapeRendering="crispEdges">
              <path d="M3 0h2v3h3v2H5v3H3V5H0V3h3z" fill={PAGE_ACCENT} />
            </svg>
            Lumen
          </span>
          <span style={{ display: "flex", gap: 22, color: PAGE_MUTED }}>
            {["product", "pricing", "docs", "blog"].map((l, i) => (
              <span key={l} style={{ color: i === 0 ? PAGE_INK : PAGE_MUTED }}>{l}</span>
            ))}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: PAGE_MUTED }}>log in</span>
            <span style={{ padding: "8px 16px", borderRadius: 999, background: PAGE_ACCENT, color: "#fff" }}>get started</span>
          </span>
        </div>
        {state.mesh ? <Mesh points={state.mesh} /> : <Hero state={state} />}
      </div>
      <DropLine state={state} />
      {state.mesh ? null : <Outline rect={{ x: h1.x - PAGE.x, y: h1.y - PAGE.y, w: h1.w, h: h1.h }} hover={state.hover} selected={state.selected} />}
      <ModeBar state={state} />
      <Toast saved={state.saved} />
    </div>
  );
};

const Outline = ({ rect, hover, selected }: { rect: Rect; hover: number; selected: number }) => {
  const on = Math.max(hover, selected);

  return (
    <div style={{ ...box({ x: rect.x - 4, y: rect.y - 4, w: rect.w + 8, h: rect.h + 8 }), outline: `${selected > 0.5 ? 2 : 1.5}px solid ${ACCENT}`, opacity: on, background: selected > 0.5 ? "transparent" : "rgba(10,132,255,.06)" }}>
      {selected > 0.5 ? (
        <span style={{ position: "absolute", top: -20, left: -2, padding: "0 5px", borderRadius: 2, background: ACCENT, color: "#fff", fontSize: 11, lineHeight: "18px", fontFamily: FONT, whiteSpace: "nowrap" }}>
          … › div.fl-container › <b>h1.title</b>
        </span>
      ) : null}
    </div>
  );
};

const RowControl = ({ row, state }: { row: PlacedRow; state: EditorState }) => {
  const v = row.values;

  if (row.control === Control.Segmented) {
    return (
      <div style={{ display: "flex", gap: 2, height: 28, padding: 2, borderRadius: 4, background: INPUT, boxSizing: "border-box" }}>
        {v.map((item, i) => (
          <span key={item} style={{ flex: 1, display: "grid", placeItems: "center", borderRadius: 3, color: item === ALIGNED ? "#fff" : TEXT_2, background: item === ALIGNED ? THUMB : "transparent" }}>
            <Ico name={item as Glyph} size={13} />
          </span>
        ))}
      </div>
    );
  }

  if (row.control === Control.Select) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 4 }}>
        {v.map((item) => (
          <span key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 28, padding: "0 8px", borderRadius: 4, background: INPUT, color: TEXT, fontSize: 12, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: item === "BDO Grotesk" ? PAGE_FONT : FONT }}>{item}</span>
            <Ico name="chevronDown" size={11} />
          </span>
        ))}
      </div>
    );
  }

  if (row.control === Control.Colour) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 6px", borderRadius: 4, background: INPUT, boxShadow: state.swatches > 0.5 ? `0 0 0 1.5px ${ACCENT}` : "none", fontSize: 12 }}>
        <span style={{ width: 16, height: 16, borderRadius: 2, background: state.headColor, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{state.headColor}</span>
        <span style={{ marginLeft: "auto", color: TEXT_3, display: "flex", gap: 8 }}>
          <Ico name="eye" size={12} />
          <Ico name="minus" size={12} />
        </span>
      </div>
    );
  }

  if (row.control === Control.Swatches) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {v.map((c) => (
          <span key={c} style={{ width: 28, height: 28, borderRadius: 4, background: c, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
        ))}
      </div>
    );
  }

  const parts = row.control === Control.Triple ? 3 : row.control === Control.Pair ? 2 : 1;
  const sizeRow = row.label === "Size" && row.control === Control.Triple;

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${parts}, minmax(0, 1fr))`, gap: 4 }}>
      {Array.from({ length: parts }, (_, i) => {
        const value = sizeRow && i < 2 ? `${Math.round(state.fontSize)}` : v[i * 3 + 1];
        return <Field key={i} prefix={v[i * 3]} value={value} unit={v[i * 3 + 2]} active={sizeRow && i === 0 && state.scrub} />;
      })}
    </div>
  );
};

const What = ({ name }: { name: string }) => (
  <div style={{ position: "absolute", left: RIGHT_X, top: BODY_Y, width: RIGHT_W, height: WHAT_H, boxSizing: "border-box", padding: "9px 14px", borderBottom: `1px solid ${DIVIDER}`, display: "flex", flexDirection: "column", gap: 2, fontSize: 12, whiteSpace: "nowrap" }}>
    <span style={{ color: TEXT_2 }}>
      … › div.fl-container › <b style={{ color: TEXT }}>{name}</b>
    </span>
    <span style={{ color: TEXT_2 }}>Hero.svelte:14 · Copy for agent · Comment</span>
    <span style={{ color: TEXT_3, fontFamily: CODE, fontSize: 11 }}>title font-display text-[64px]</span>
  </div>
);

const Properties = ({ state }: { state: EditorState }) => {
  const sections = placeProps(state.mesh ? MESH_PROPS : TEXT_PROPS);
  const shown = state.mesh ? 1 : state.selected;

  return (
    <div style={{ opacity: 0.25 + 0.75 * shown }}>
      <What name={state.mesh ? "div.mesh" : "h1.title"} />
      <span style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + WHAT_H + 8, height: EDITING_H - 12, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", border: "1px solid #9a9a9a", background: "#f0f0f0", borderRadius: 3, color: ACCENT, fontSize: 12.5, fontWeight: 700 }}>
        editing: auto · 720px
        <Ico name="chevronDown" size={10} />
      </span>
      <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + WHAT_H + EDITING_H + 4, width: RIGHT_W - 2 * SIDE_PAD, height: SCOPE_H - 8, display: "flex", gap: 2, padding: 2, boxSizing: "border-box", borderRadius: 6, background: INPUT, fontSize: 12.5 }}>
        <span style={{ flex: 1, display: "grid", placeItems: "center", borderRadius: 4, background: THUMB, color: "#fff" }}>This element</span>
        <span style={{ flex: 1, display: "grid", placeItems: "center", color: TEXT_2 }}>All .title (1)</span>
      </div>
      <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: STATE_Y, width: RIGHT_W - 2 * SIDE_PAD, height: ROW_H, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: LABEL_W, flex: "none", color: TEXT_2, fontSize: 12.5 }}>State</span>
        <span style={{ flex: 1, height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", borderRadius: 4, background: INPUT, fontSize: 12 }}>
          Default
          <Ico name="chevronDown" size={11} />
        </span>
      </div>
      {sections.map((section) => (
        <div key={section.title}>
          <div style={{ position: "absolute", left: RIGHT_X, top: section.y, width: RIGHT_W, height: HEAD_H, display: "flex", alignItems: "center", gap: 4, padding: "0 10px 0 6px", boxSizing: "border-box", borderTop: `1px solid ${DIVIDER}`, fontSize: 12.5, fontWeight: 600, color: TEXT }}>
            <span style={{ color: TEXT_3, display: "grid" }}>
              <Ico name={section.rows.length ? "chevronDown" : "chevronRight"} size={12} />
            </span>
            {section.title}
            {section.badge ? <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: "rgba(255,81,0,.18)", color: "#ff8a3d", fontWeight: 500, fontSize: 10 }}>{section.badge}</span> : null}
            <span style={{ marginLeft: "auto", color: TEXT_2, display: "grid" }}>
              <Ico name="plus" size={13} />
            </span>
          </div>
          {section.placed.map((row) => (
            <div key={row.label} style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: row.y, width: RIGHT_W - 2 * SIDE_PAD, height: ROW_H, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: LABEL_W, flex: "none", color: TEXT_2, fontSize: 12.5 }}>{row.label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <RowControl row={row} state={state} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const Changes = ({ state }: { state: EditorState }) => (
  <div style={{ position: "absolute", left: RIGHT_X, top: BODY_Y, width: RIGHT_W, fontSize: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${DIVIDER}`, color: TEXT_2 }}>
      1 file changed
      <span style={{ marginLeft: "auto", color: LINK }}>Source Control</span>
      <span style={{ color: DANGER }}>Revert all</span>
    </div>
    {CHANGES.map((change, i) => {
      const p = Math.min(1, Math.max(0, state.changes - i * 2));

      return (
        <div key={change.prop} style={{ padding: "10px 12px", borderBottom: `1px solid ${DIVIDER}`, opacity: p, transform: `translateX(${(1 - p) * 12}px)` }}>
          <div>
            <b style={{ color: TEXT, fontWeight: 600 }}>{change.prop}</b> <span style={{ color: TEXT_2 }}>{change.value}</span>
          </div>
          <div style={{ color: TEXT_3, fontSize: 11, marginTop: 3 }}>Hero.svelte · This element · 11:47 AM</div>
          <div style={{ display: "flex", gap: 12, marginTop: 3, color: LINK, fontSize: 11 }}>
            {i === 0 ? "Hide diff" : "Show diff"}
            <span>Revert</span>
          </div>
          {i === 0 ? (
            <div style={{ marginTop: 8, borderRadius: 4, border: `1px solid ${DIVIDER}`, background: "#141414", overflow: "hidden" }}>
              {DIFF_LINES.map((line, j) => {
                const s = DIFF_STYLE[line.kind];
                const q = Math.min(1, Math.max(0, state.changes - 1 - j * 0.5));

                return (
                  <div key={j} style={{ display: "flex", gap: 6, padding: "2px 8px", background: s.bg, color: s.fg, fontFamily: CODE, fontSize: 10.5, whiteSpace: "pre", opacity: q }}>
                    <span style={{ width: 16, color: TEXT_3, textAlign: "right" }}>{line.n}</span>
                    <span style={{ width: 8 }}>{s.sign}</span>
                    {line.text}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
);

const Comments = () => <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + 14, color: TEXT_3, fontSize: 12 }}>No comments yet</div>;

const PANES: Record<Tab, (props: { state: EditorState }) => ReactNode> = {
  [Tab.Properties]: Properties,
  [Tab.Changes]: Changes,
  [Tab.Comments]: Comments,
};

const RightBar = ({ state }: { state: EditorState }) => {
  const Pane = PANES[state.tab];

  return (
    <>
      <div style={{ position: "absolute", left: RIGHT_X, top: 0, width: RIGHT_W, height: WIN.h, background: PANEL, borderLeft: `1px solid ${DIVIDER}`, boxSizing: "border-box" }}>
        <div style={{ height: TOP_ROW, borderBottom: `1px solid ${DIVIDER}`, boxSizing: "border-box" }} />
      </div>
      {Object.values(Tab).map((tab) => (
        <span key={tab} style={{ ...box(TABS[tab]), display: "grid", placeItems: "center", borderRadius: 5, fontSize: 13, background: state.tab === tab ? INPUT : "transparent", color: state.tab === tab ? TEXT : TEXT_2 }}>
          {tab === Tab.Changes && state.changes > 0 ? `${tab} ${CHANGES.length}` : tab}
        </span>
      ))}
      <Pane state={state} />
    </>
  );
};

const Popover = ({ state }: { state: EditorState }) => (
  <div style={{ ...box(POPOVER), borderRadius: 10, background: "#232323", boxShadow: `0 0 0 1px #3a3a3a, 0 16px 40px rgba(0,0,0,.45)`, transform: `scale(${state.swatches})`, transformOrigin: "100% 100%", opacity: state.swatches }}>
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px 0", fontSize: 11, color: TEXT }}>
      <b style={{ fontWeight: 600 }}>Colour</b>
      <span style={{ color: TEXT_3 }}>Document</span>
    </div>
    {SWATCHES.map((c, i) => {
      const r = swatchRect(i);
      return <span key={c} style={{ ...box({ x: r.x - POPOVER.x, y: r.y - POPOVER.y, w: r.w, h: r.h }), borderRadius: 6, background: c, boxShadow: c === state.headColor ? "0 0 0 2px #232323, 0 0 0 4px #fff" : "inset 0 0 0 1px rgba(255,255,255,.2)" }} />;
    })}
  </div>
);

export const Press = ({ rect, amount }: { rect: Rect; amount: number }) => {
  if (amount <= 0) {
    return null;
  }

  const grow = (1 - amount) * 10;

  return <div style={{ ...box({ x: rect.x - grow, y: rect.y - grow, w: rect.w + 2 * grow, h: rect.h + 2 * grow }), borderRadius: 8, background: `rgba(10,132,255,${0.28 * amount})`, boxShadow: `0 0 0 2px rgba(10,132,255,${amount})`, pointerEvents: "none" }} />;
};

export const PRESS_FRAMES = 10;

export const pressAmount = (frame: number, at: number) => (frame < at - 1 || frame > at + PRESS_FRAMES ? 0 : 1 - Math.max(0, frame - at) / PRESS_FRAMES);

export const LibraryGhost = ({ pick, x, y, t }: { pick: number; x: number; y: number; t: number }) => {
  const r = libraryRect(pick);

  return (
    <div style={{ position: "absolute", left: x - r.w / 2, top: y - 20, width: r.w, height: r.h - 30, borderRadius: 6, overflow: "hidden", background: "#fff", boxShadow: "0 16px 36px rgba(0,0,0,.45), 0 0 0 2px #0a84ff", transform: `rotate(${-4 * Math.sin(Math.PI * t)}deg) scale(${1 + 0.15 * Math.sin(Math.PI * t)})`, opacity: 0.94 }}>
      <PricingThumb width={r.w} />
    </div>
  );
};

export const FeegaEditor = ({ state }: { state: EditorState }) => (
  <div style={{ position: "relative", width: WIN.w, height: WIN.h, borderRadius: 10, overflow: "hidden", background: "#1f1f1f", boxShadow: "0 0 0 1px #3c3c3c, 0 40px 100px rgba(0,0,0,.45)", fontFamily: FONT, fontSize: 13, color: TEXT }}>
    <LeftBar state={state} />
    <Toolbar />
    <Preview state={state} />
    <RightBar state={state} />
    <Popover state={state} />
    {state.presses.map((p, i) => (
      <Press key={i} rect={p.rect} amount={p.amount} />
    ))}
  </div>
);
