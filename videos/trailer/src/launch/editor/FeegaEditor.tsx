import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { FeegaMark } from "../../components/brandIcons";
import { GLYPH, LAYER, type Glyph, type LayerGlyph } from "./glyphs";
import {
  BASE_FONT, BODY_Y, COPY_BUTTON, Control, H1_LEFT, H1_TOP, H1_W, HEAD_H, LABEL_W, LAYERS_TOP, LAYER_ROW, LEFT_W, LIBRARY_TOP, MESH_BOX, MESH_PROPS,
  PAGE, POPOVER, RIGHT_W, RIGHT_X, ROW_H, RULER, SCOPE_H, SIDE_PAD, TABS, TAB_STRIP, TEXT_PROPS, TOP_ROW, Tab, WHAT_H, WIN, controlRect, h1Rect,
  libraryRect, placeProps, swatchRect, type PlacedRow, type Point, type Rect,
} from "./layout";

const ACCENT = "#0a84ff";
const PANEL = "#181818";
const TEXT = "#cccccc";
const TEXT_2 = "rgba(204,204,204,.6)";
const TEXT_3 = "rgba(204,204,204,.4)";
const DIVIDER = "#2b2b2b";
const INPUT = "#2a2a2a";
const THUMB = "#5a5a5e";
const BACKDROP = "#262626";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const CODE = '"Fragment Mono", "SF Mono", Menlo, monospace';
const PAGE_BG = "#f6efe6";
const PAGE_INK = "#2a1c12";
const PAGE_ACCENT = "#b4532a";
const SERIF = "Georgia, serif";

export const SWATCHES = ["#2a1c12", "#ff5100", "#004dff", "#1f9d55", "#c026d3"];

export const LIBRARY = [
  { name: "Pricing", src: "pricing-light" },
  { name: "Bento grid", src: "bento-grid-dark" },
  { name: "Features", src: "features-grid-light" },
  { name: "FAQ", src: "faq-dark" },
  { name: "Blog cards", src: "blog-cards-light" },
  { name: "Comparison", src: "comparison-table-light" },
];

type Layer = { depth: number; open?: boolean; icon: LayerGlyph; name: string; count?: string; h1?: boolean };

const LAYERS: Layer[] = [
  { depth: 0, open: true, icon: "block", name: "html" },
  { depth: 1, open: true, icon: "flexColumn", name: "body" },
  { depth: 2, open: true, icon: "header", name: "header.bar" },
  { depth: 3, icon: "flexRow", name: "a.brand" },
  { depth: 3, open: true, icon: "nav", name: "nav" },
  { depth: 4, icon: "link", name: "a", count: "×4" },
  { depth: 3, icon: "button", name: "button.cta" },
  { depth: 2, open: true, icon: "flexColumn", name: "section.hero" },
  { depth: 3, icon: "text", name: "span.tag" },
  { depth: 3, icon: "h1", name: "h1.title", h1: true },
  { depth: 3, icon: "text", name: "p.lead" },
  { depth: 3, icon: "flexRow", name: "div.actions" },
  { depth: 2, open: true, icon: "grid", name: "section.products" },
  { depth: 3, icon: "repeat", name: "article.card", count: "×3" },
  { depth: 2, icon: "grid", name: "section.plans" },
  { depth: 2, icon: "footer", name: "footer" },
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
  { kind: Diff.Same, text: '  <span class="tag">New</span>', n: 13 },
  { kind: Diff.Removed, text: '  <h1 class="text-[64px]', n: 14 },
  { kind: Diff.Removed, text: '      text-[#2a1c12]">', n: 15 },
  { kind: Diff.Added, text: '  <h1 class="text-[76px]', n: 14 },
  { kind: Diff.Added, text: '      text-[#ff5100]">', n: 15 },
  { kind: Diff.Same, text: "    Scent, slowly made.", n: 16 },
  { kind: Diff.Same, text: "  </h1>", n: 17 },
];

export const DIFF_COUNT = DIFF_LINES.length;

const PLANS = [
  { name: "Single", price: "€24", note: "one refill a season" },
  { name: "Duo", price: "€44", note: "two scents, swapped monthly" },
  { name: "Atelier", price: "€80", note: "a private blending session" },
];

export type MeshPoint = { x: number; y: number; c: string };

export type EditorState = {
  tab: Tab;
  hover: number;
  selected: number;
  fontSize: number;
  headColor: string;
  scrub: boolean;
  swatches: number;
  changes: number;
  copied: number;
  library: { pick: number; inserted: number } | null;
  built: number;
  mesh: MeshPoint[] | null;
  presses: { rect: Rect; amount: number }[];
};

export const EDITOR_REST: EditorState = {
  tab: Tab.Properties,
  hover: 0,
  selected: 0,
  fontSize: BASE_FONT,
  headColor: SWATCHES[0],
  scrub: false,
  swatches: 0,
  changes: 0,
  copied: 0,
  library: null,
  built: 0,
  mesh: null,
  presses: [],
};

const Ico = ({ name, size = 14 }: { name: Glyph; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: GLYPH[name] }} />
);

const LayerIco = ({ name }: { name: LayerGlyph }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", color: TEXT_3 }} dangerouslySetInnerHTML={{ __html: LAYER[name] }} />
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
    <span style={{ flex: 1, color: TEXT, fontSize: 12, fontVariantNumeric: "tabular-nums", overflow: "hidden", whiteSpace: "nowrap" }}>{value}</span>
    <span style={{ color: TEXT_3, fontSize: 11, paddingRight: 6 }}>{unit}</span>
  </div>
);

const TabStrip = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: WIN.w, height: TAB_STRIP, background: PANEL, borderBottom: `1px solid ${DIVIDER}`, display: "flex", alignItems: "flex-end" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 7, height: TAB_STRIP, padding: "0 14px", borderTop: "1px solid #0078d4", borderRight: `1px solid ${DIVIDER}`, background: "#1f1f1f", color: "#fff", fontSize: 13 }}>
      <FeegaMark size={15} />
      Feega
      <span style={{ color: TEXT_3, marginLeft: 6 }}>×</span>
    </span>
    <span style={{ display: "flex", alignItems: "center", gap: 7, height: TAB_STRIP, padding: "0 14px", borderRight: `1px solid ${DIVIDER}`, color: TEXT_2, fontSize: 13 }}>
      <span style={{ color: "#ff3e00", fontWeight: 700 }}>S</span>
      Hero.svelte
    </span>
  </div>
);

const Layers = ({ state }: { state: EditorState }) => (
  <div style={{ position: "absolute", left: 0, top: TAB_STRIP, width: LEFT_W, height: WIN.h - TAB_STRIP, background: PANEL, borderRight: `1px solid ${DIVIDER}` }}>
    <div style={{ height: TOP_ROW, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: `1px solid ${DIVIDER}`, color: TEXT_2, fontSize: 11, fontWeight: 600 }}>
      Layers
      <span style={{ display: "flex", gap: 4, color: TEXT_2 }}>
        <Ico name="plus" size={14} />
      </span>
    </div>
    <div style={{ position: "absolute", top: LAYERS_TOP - TAB_STRIP, left: 0, right: 0 }}>
      {LAYERS.map((row) => {
        const picked = row.h1 && state.selected > 0.5;
        const fresh = row.name === "section.plans" ? state.built : 0;

        return (
          <div key={row.name + row.depth} style={{ display: "flex", alignItems: "center", gap: 4, height: LAYER_ROW, paddingLeft: 8 + row.depth * 12, paddingRight: 8, fontSize: 12, color: TEXT, background: picked ? "rgba(10,132,255,.22)" : fresh ? `rgba(80,220,140,${0.18 * fresh})` : row.h1 && state.hover > 0.5 ? "rgba(255,255,255,.05)" : "transparent", opacity: row.name === "section.plans" ? 0.35 + 0.65 * state.built : 1 }}>
            <span style={{ width: 14, display: "grid", placeItems: "center", color: TEXT_3, transform: row.open ? "rotate(90deg)" : "none" }}>{row.open ? <Ico name="chevronRight" size={12} /> : null}</span>
            <LayerIco name={row.icon} />
            <span>{row.name}</span>
            {row.count ? <span style={{ marginLeft: "auto", color: TEXT_3, fontSize: 11 }}>{row.count}</span> : null}
          </div>
        );
      })}
    </div>
  </div>
);

const Toolbar = () => (
  <div style={{ position: "absolute", left: LEFT_W, top: TAB_STRIP, width: PAGE.w, height: TOP_ROW, background: PANEL, borderBottom: `1px solid ${DIVIDER}`, display: "flex", alignItems: "center", gap: 4, padding: "0 8px", boxSizing: "border-box" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 6px", color: TEXT_2 }}>
      <FeegaMark size={16} />
      <Ico name="chevronDown" size={12} />
    </span>
    <IconButton name="panelLeft" on />
    <IconButton name="arrowLeft" dim />
    <IconButton name="arrowRight" dim />
    <IconButton name="reload" />
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 10px", borderRadius: 999, background: INPUT, fontSize: 12, color: TEXT }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: "#30d158" }} />
      localhost:5173<span style={{ color: TEXT_3 }}>/</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", padding: 2, borderRadius: 4, background: INPUT }}>
      {(["full", "desktop", "tablet", "phone"] as Glyph[]).map((d, i) => (
        <span key={d} style={{ display: "grid", placeItems: "center", width: 24, height: 20, borderRadius: 2, color: i === 1 ? TEXT : TEXT_2, background: i === 1 ? "#232323" : "transparent", boxShadow: i === 1 ? `0 0 0 1px ${DIVIDER}` : "none" }}>
          <Ico name={d} />
        </span>
      ))}
    </div>
    <span style={{ height: 24, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", borderRadius: 4, background: INPUT, color: TEXT_2, fontSize: 12 }}>
      <span style={{ color: TEXT }}>1280</span>×<span>800</span>
    </span>
    <span style={{ height: 24, display: "flex", alignItems: "center", padding: "0 6px", borderRadius: 4, background: INPUT, color: TEXT, fontSize: 12 }}>100%</span>
    <IconButton name="panelRight" on />
  </div>
);

const BREAKPOINTS = [
  { label: "sm", at: 0.3 },
  { label: "md", at: 0.45 },
  { label: "lg", at: 0.68 },
  { label: "xl", at: 0.9 },
];

const Ruler = () => (
  <div style={{ position: "absolute", left: LEFT_W, top: BODY_Y, width: PAGE.w, height: RULER, background: "#1c1c1c", borderBottom: `1px solid ${DIVIDER}` }}>
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${BREAKPOINTS[3].at * 100}%`, background: "rgba(10,132,255,.12)" }} />
    {BREAKPOINTS.map((b, i) => (
      <div key={b.label} style={{ position: "absolute", left: `${b.at * 100}%`, top: 0, bottom: 0, borderLeft: `1px solid ${i === 3 ? ACCENT : "#3a3a3a"}`, paddingLeft: 5, fontSize: 10, lineHeight: `${RULER}px`, color: i === 3 ? "#7fb8ff" : TEXT_3 }}>
        {b.label}
      </div>
    ))}
  </div>
);

const Plans = ({ built }: { built: number }) => (
  <div style={{ height: 196 * built, overflow: "hidden", padding: `0 ${H1_LEFT}px` }}>
    <div style={{ paddingTop: 34, fontFamily: SERIF, fontSize: 26, letterSpacing: "-0.02em" }}>Refill plans</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 14 }}>
      {PLANS.map((plan, i) => {
        const p = Math.min(1, Math.max(0, built * 3 - i));

        return (
          <div key={plan.name} style={{ height: 104, borderRadius: 12, background: i === 1 ? PAGE_INK : "#ebdfd0", color: i === 1 ? "#fff" : PAGE_INK, padding: "14px 16px", boxSizing: "border-box", opacity: p, transform: `translateY(${(1 - p) * 16}px)`, fontSize: 12 }}>
            <b style={{ fontWeight: 600 }}>{plan.name}</b>
            <div style={{ fontFamily: SERIF, fontSize: 30, marginTop: 6 }}>{plan.price}</div>
            <div style={{ opacity: 0.7, marginTop: 4 }}>{plan.note}</div>
          </div>
        );
      })}
    </div>
  </div>
);

const Mesh = ({ points }: { points: MeshPoint[] }) => {
  const r = { x: MESH_BOX.x - PAGE.x, y: MESH_BOX.y - PAGE.y, w: MESH_BOX.w, h: MESH_BOX.h };
  const background = points.map((p) => `radial-gradient(circle at ${p.x}px ${p.y}px, ${p.c} 0, transparent 62%)`).join(", ");

  return (
    <div style={{ ...box(r), borderRadius: 14, background: `${background}, #f6efe6`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 36, top: 120, fontFamily: SERIF, fontSize: 58, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>Ambre Noir</div>
      <div style={{ position: "absolute", left: 38, top: 192, fontSize: 14, color: "rgba(255,255,255,.85)" }}>eau de parfum · 50 ml</div>
      <div style={{ position: "absolute", inset: 0, outline: `2px solid ${ACCENT}`, outlineOffset: -2, borderRadius: 14 }} />
      {points.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x - 10, top: p.y - 10, width: 20, height: 20, borderRadius: 10, background: p.c, border: "3px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.25), 0 2px 6px rgba(0,0,0,.3)" }} />
      ))}
    </div>
  );
};

const Preview = ({ state }: { state: EditorState }) => {
  const h1 = h1Rect(state.fontSize);
  const below = H1_TOP + state.fontSize * 2;

  return (
    <div style={{ ...box(PAGE), background: BACKDROP, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: PAGE_BG, color: PAGE_INK, fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `20px ${H1_LEFT}px`, fontSize: 11 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: SERIF, fontSize: 17, fontWeight: 600 }}>
            <i style={{ width: 20, height: 20, borderRadius: 10, background: PAGE_INK }} />
            Aurel
          </span>
          <span style={{ display: "flex", gap: 26 }}>
            {["Collection", "Refills", "Atelier", "Journal"].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </span>
          <span style={{ padding: "8px 16px", borderRadius: 999, background: PAGE_ACCENT, color: "#fff", fontWeight: 600 }}>Bag (0)</span>
        </div>
        {state.mesh ? (
          <Mesh points={state.mesh} />
        ) : (
          <>
            <span style={{ position: "absolute", left: H1_LEFT, top: H1_TOP - 34, padding: "5px 12px", borderRadius: 999, background: "#ebdfd0", fontSize: 10 }}>New · Ambre Noir, eau de parfum</span>
            <div style={{ position: "absolute", left: H1_LEFT, top: H1_TOP, width: H1_W, fontFamily: SERIF, fontSize: state.fontSize, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1, color: state.headColor }}>Scent, slowly made.</div>
            <div style={{ position: "absolute", left: 0, right: 0, top: below + 16 }}>
              <p style={{ margin: `0 ${H1_LEFT}px`, maxWidth: 460, color: "#6b5645", fontSize: 14, lineHeight: "20px" }}>Small-batch perfume, blended by hand in Grasse and refilled for life. Nothing rushed, nothing wasted.</p>
              <div style={{ display: "flex", gap: 10, margin: `22px ${H1_LEFT}px 0`, fontSize: 12, fontWeight: 600 }}>
                <span style={{ padding: "11px 20px", borderRadius: 999, background: PAGE_INK, color: "#fff" }}>Shop the collection</span>
                <span style={{ padding: "11px 20px", borderRadius: 999, boxShadow: `inset 0 0 0 1px ${PAGE_INK}` }}>Find your scent</span>
              </div>
              {state.library ? (
                <div style={{ margin: `${26 * state.library.inserted}px ${H1_LEFT}px 0`, height: 220 * state.library.inserted, overflow: "hidden", borderRadius: 12, boxShadow: `0 0 0 2px ${ACCENT}` }}>
                  <Img src={staticFile(`templates/${LIBRARY[state.library.pick].src}.webp`)} style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                </div>
              ) : null}
              <Plans built={state.built} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: `40px ${H1_LEFT}px 0` }}>
                {[
                  ["Ambre Noir", "€128", "linear-gradient(135deg, #e7a46a, #b4532a)"],
                  ["Fig & Cedar", "€112", "linear-gradient(135deg, #cdd5b5, #7c8a5a)"],
                  ["Iris Blanc", "€104", "linear-gradient(135deg, #d9d4ea, #8c82b8)"],
                ].map(([name, price, bg]) => (
                  <div key={name} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    <i style={{ height: 150, marginBottom: 8, borderRadius: 12, background: bg }} />
                    <b style={{ fontWeight: 600 }}>{name}</b>
                    <span style={{ color: "#6b5645" }}>{price}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, padding: 4, borderRadius: 10, background: "rgba(24,24,24,.94)", boxShadow: `0 0 0 1px ${DIVIDER}, 0 8px 24px rgba(0,0,0,.22)`, fontSize: 12 }}>
        <span style={{ display: "flex", padding: 2, borderRadius: 999, background: INPUT }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, height: 28, width: 96, justifyContent: "center", borderRadius: 999, background: THUMB, color: "#fff" }}>
            <Ico name="design" />
            Design
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, height: 28, width: 96, justifyContent: "center", color: TEXT_2 }}>
            <Ico name="hand" />
            Navigate
          </span>
        </span>
        <IconButton name="undo" dim={state.changes === 0} />
        <IconButton name="redo" dim />
      </div>
      {state.mesh ? null : <Outline rect={{ x: h1.x - PAGE.x, y: h1.y - PAGE.y, w: h1.w, h: h1.h }} hover={state.hover} selected={state.selected} fontSize={state.fontSize} />}
    </div>
  );
};

const Outline = ({ rect, hover, selected, fontSize }: { rect: Rect; hover: number; selected: number; fontSize: number }) => {
  const on = Math.max(hover, selected);

  return (
    <div style={{ ...box({ x: rect.x - 4, y: rect.y - 4, w: rect.w + 8, h: rect.h + 8 }), outline: `${selected > 0.5 ? 2 : 1.5}px solid ${ACCENT}`, opacity: on, background: selected > 0.5 ? "transparent" : "rgba(10,132,255,.06)" }}>
      {selected > 0.5 ? (
        <>
          <span style={{ position: "absolute", top: -19, left: -2, padding: "0 5px", borderRadius: 2, background: ACCENT, color: "#fff", fontSize: 11, lineHeight: "17px", fontFamily: FONT }}>h1.title</span>
          <span style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", padding: "0 5px", borderRadius: 2, background: ACCENT, color: "#fff", fontSize: 10, lineHeight: "16px", fontFamily: FONT }}>
            {H1_W} × {fontSize * 2}
          </span>
          {[
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ].map(([x, y]) => (
            <span key={`${x}${y}`} style={{ position: "absolute", left: `calc(${x * 100}% - 4px)`, top: `calc(${y * 100}% - 4px)`, width: 7, height: 7, background: "#fff", border: `1px solid ${ACCENT}` }} />
          ))}
        </>
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
          <span key={item} style={{ flex: 1, display: "grid", placeItems: "center", borderRadius: 3, fontSize: 11, color: i === 1 ? "#fff" : TEXT_2, background: i === 1 ? THUMB : "transparent" }}>
            {item}
          </span>
        ))}
      </div>
    );
  }

  if (row.control === Control.Select) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 4 }}>
        {v.map((item) => (
          <span key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 28, padding: "0 8px", borderRadius: 4, background: INPUT, color: TEXT, fontSize: 12 }}>
            <span style={{ fontFamily: item === "Georgia" ? SERIF : FONT }}>{item}</span>
            <Ico name="chevronDown" size={11} />
          </span>
        ))}
      </div>
    );
  }

  if (row.control === Control.Colour) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 6px", borderRadius: 4, background: INPUT, boxShadow: state.swatches > 0.5 ? `0 0 0 1.5px ${ACCENT}` : "none", fontSize: 12 }}>
        <span style={{ width: 16, height: 16, borderRadius: 2, background: state.headColor, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{state.headColor}</span>
        <span style={{ marginLeft: "auto", color: TEXT_3 }}>100%</span>
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

const Properties = ({ state }: { state: EditorState }) => {
  const sections = placeProps(state.mesh ? MESH_PROPS : TEXT_PROPS);
  const shown = state.mesh ? 1 : state.selected;

  return (
    <div style={{ opacity: 0.25 + 0.75 * shown }}>
      <div style={{ position: "absolute", left: RIGHT_X, top: BODY_Y, width: RIGHT_W, height: WHAT_H, boxSizing: "border-box", padding: "12px 16px", borderBottom: `1px solid ${DIVIDER}`, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
        <span style={{ color: TEXT_2 }}>
          … › +page › Hero › <b style={{ color: TEXT }}>{state.mesh ? "div.mesh" : "h1.title"}</b>
        </span>
        <span style={{ color: TEXT_3 }}>
          in +page.svelte · <span style={{ color: TEXT_2 }}>Hero.svelte:14</span>
        </span>
      </div>
      <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + WHAT_H + 4, width: RIGHT_W - 2 * SIDE_PAD, height: SCOPE_H - 8, display: "flex", gap: 2, padding: 2, boxSizing: "border-box", borderRadius: 6, background: INPUT, fontSize: 11 }}>
        <span style={{ flex: 1, display: "grid", placeItems: "center", borderRadius: 4, background: THUMB, color: "#fff" }}>This element</span>
        <span style={{ flex: 1, display: "grid", placeItems: "center", color: TEXT_2 }}>All .title (2)</span>
      </div>
      {sections.map((section) => (
        <div key={section.title}>
          <div style={{ position: "absolute", left: RIGHT_X, top: section.y, width: RIGHT_W, height: HEAD_H, display: "flex", alignItems: "center", gap: 4, padding: "0 10px 0 6px", boxSizing: "border-box", borderTop: `1px solid ${DIVIDER}`, fontSize: 11, fontWeight: 600, color: TEXT }}>
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
              <span style={{ width: LABEL_W, flex: "none", color: TEXT_2, fontSize: 11 }}>{row.label}</span>
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
  <div>
    <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + 12, width: RIGHT_W - 2 * SIDE_PAD, fontSize: 11, color: TEXT_2, display: "flex", justifyContent: "space-between" }}>
      <span>
        <b style={{ color: TEXT }}>2 changes</b> · 1 file
      </span>
      <span>
        <span style={{ color: "#8fe8b4" }}>+2</span> <span style={{ color: "#ff9a9a" }}>−2</span>
      </span>
    </div>
    <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + 36, width: RIGHT_W - 2 * SIDE_PAD, borderRadius: 6, border: `1px solid ${DIVIDER}`, overflow: "hidden", background: "#141414" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: `1px solid ${DIVIDER}`, fontSize: 11, color: TEXT }}>
        <span style={{ color: "#ff3e00", fontWeight: 700 }}>S</span>
        src/lib/Hero.svelte
        <span style={{ marginLeft: "auto", color: TEXT_3 }}>:14</span>
      </div>
      {DIFF_LINES.map((line, i) => {
        const s = DIFF_STYLE[line.kind];
        const p = Math.min(1, Math.max(0, state.changes - i));

        return (
          <div key={i} style={{ display: "flex", gap: 6, padding: "3px 8px", background: s.bg, color: s.fg, fontFamily: CODE, fontSize: 10.5, whiteSpace: "pre", opacity: p, transform: `translateX(${(1 - p) * 12}px)` }}>
            <span style={{ width: 16, color: TEXT_3, textAlign: "right" }}>{line.n}</span>
            <span style={{ width: 8 }}>{s.sign}</span>
            {line.text}
          </div>
        );
      })}
    </div>
    <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + 290, width: RIGHT_W - 2 * SIDE_PAD, fontSize: 11, color: TEXT_2, lineHeight: "18px" }}>
      <div style={{ color: TEXT, fontWeight: 600, marginBottom: 4 }}>History</div>
      <div>font-size 64 → 76px</div>
      <div>color #2a1c12 → #ff5100</div>
    </div>
    <div style={{ ...box(COPY_BUTTON), display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 6, background: state.copied > 0.5 ? "#1f6f43" : ACCENT, color: "#fff", fontSize: 12, fontWeight: 600 }}>
      {state.copied > 0.5 ? "✓ Copied for agent" : "Copy for agent"}
    </div>
  </div>
);

const Library = ({ state }: { state: EditorState }) => (
  <div>
    <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + 10, width: RIGHT_W - 2 * SIDE_PAD, height: 28, borderRadius: 6, background: INPUT, display: "flex", alignItems: "center", padding: "0 10px", boxSizing: "border-box", fontSize: 12, color: TEXT_3 }}>
      Search 61 templates
    </div>
    <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: BODY_Y + 48, display: "flex", gap: 6, fontSize: 11 }}>
      {["All", "Sections", "Components", "Pages"].map((c, i) => (
        <span key={c} style={{ padding: "4px 9px", borderRadius: 999, background: i === 1 ? THUMB : INPUT, color: i === 1 ? "#fff" : TEXT_2 }}>{c}</span>
      ))}
    </div>
    <div style={{ position: "absolute", left: RIGHT_X + SIDE_PAD, top: LIBRARY_TOP - 18, fontSize: 11, fontWeight: 600, color: TEXT }}>Sections</div>
    {LIBRARY.map((item, i) => {
      const r = libraryRect(i);
      const picked = state.library?.pick === i && state.library.inserted > 0;

      return (
        <div key={item.name} style={{ ...box(r) }}>
          <div style={{ height: r.h - 22, borderRadius: 6, overflow: "hidden", boxShadow: picked ? `0 0 0 2px ${ACCENT}` : `0 0 0 1px ${DIVIDER}` }}>
            <Img src={staticFile(`templates/${item.src}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: picked ? "#7fb8ff" : TEXT_2 }}>{picked ? `✓ ${item.name}` : item.name}</div>
        </div>
      );
    })}
  </div>
);

const PANES: Record<Tab, (props: { state: EditorState }) => ReactNode> = {
  [Tab.Properties]: Properties,
  [Tab.Changes]: Changes,
  [Tab.Library]: Library,
};

const RightBar = ({ state }: { state: EditorState }) => {
  const Pane = PANES[state.tab];

  return (
    <>
      <div style={{ position: "absolute", left: RIGHT_X, top: TAB_STRIP, width: RIGHT_W, height: WIN.h - TAB_STRIP, background: PANEL, borderLeft: `1px solid ${DIVIDER}`, boxSizing: "border-box" }}>
        <div style={{ height: TOP_ROW, borderBottom: `1px solid ${DIVIDER}` }} />
      </div>
      {Object.values(Tab).map((tab) => (
        <span key={tab} style={{ ...box(TABS[tab]), display: "grid", placeItems: "center", borderRadius: 4, fontSize: 12, background: state.tab === tab ? INPUT : "transparent", color: state.tab === tab ? TEXT : TEXT_2 }}>
          {tab}
          {tab === Tab.Changes && state.changes > 0 ? <span style={{ position: "absolute", top: 3, right: 3, width: 6, height: 6, borderRadius: 3, background: ACCENT }} /> : null}
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

export const FeegaEditor = ({ state }: { state: EditorState }) => (
  <div style={{ position: "relative", width: WIN.w, height: WIN.h, borderRadius: 10, overflow: "hidden", background: "#1f1f1f", boxShadow: "0 0 0 1px #3c3c3c, 0 40px 100px rgba(0,0,0,.45)", fontFamily: FONT, fontSize: 13, color: TEXT }}>
    <TabStrip />
    <Layers state={state} />
    <Toolbar />
    <Ruler />
    <Preview state={state} />
    <RightBar state={state} />
    <Popover state={state} />
    {state.presses.map((p, i) => (
      <Press key={i} rect={p.rect} amount={p.amount} />
    ))}
  </div>
);

