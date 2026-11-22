import { ORANGE, UI } from "./style";

const PANEL = "#1c1c1b";
const LINE = "#2e2e2c";
const TEXT = "#e9e7e2";
const DIM = "#8a8780";
const SELECT = "#2f6bff";

export type EditorState = {
  hover: number;
  selected: number;
  fontSize: number;
  headColor: string;
  scrubbing: boolean;
  swatchOpen: number;
};

const LAYERS = [
  { name: "body", depth: 0 },
  { name: "header", depth: 1 },
  { name: "nav", depth: 2 },
  { name: "main", depth: 1 },
  { name: "h1", depth: 2, target: true },
  { name: "p", depth: 2 },
  { name: "button", depth: 2 },
  { name: "footer", depth: 1 },
];

export const SWATCHES = ["#0b0b0a", ORANGE, "#004dff", "#1f9d55", "#c026d3"];

const Row = ({ label, value, active }: { label: string; value: string; active?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
    <span style={{ color: DIM }}>{label}</span>
    <span style={{ minWidth: 96, padding: "5px 10px", borderRadius: 6, background: active ? "#30302d" : "#252523", outline: active ? `1.5px solid ${SELECT}` : "none", color: TEXT, fontVariantNumeric: "tabular-nums" }}>{value}</span>
  </div>
);

export const EditorCard = ({ state }: { state: EditorState }) => {
  const { hover, selected, fontSize, headColor, scrubbing, swatchOpen } = state;
  const outline = Math.max(hover, selected);

  return (
    <div style={{ width: 1120, height: 660, borderRadius: 16, background: PANEL, border: `1px solid ${LINE}`, display: "flex", overflow: "hidden", fontFamily: UI, fontSize: 15, color: TEXT, boxShadow: "0 40px 90px rgba(0,0,0,.35)" }}>
      <div style={{ width: 210, borderRight: `1px solid ${LINE}`, padding: "16px 12px" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: DIM, marginBottom: 12 }}>LAYERS</div>
        {LAYERS.map((l) => (
          <div key={l.name} style={{ padding: "6px 8px", paddingLeft: 8 + l.depth * 16, borderRadius: 6, background: l.target && selected > 0.5 ? SELECT : "transparent", color: l.target && selected > 0.5 ? "#fff" : TEXT }}>
            {l.name}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, background: "#121211", padding: 22, display: "flex" }}>
        <div style={{ flex: 1, background: "#fbfaf7", borderRadius: 8, color: "#111", padding: "26px 40px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#555" }}>
            <b style={{ color: "#111" }}>northwind</b>
            <span>product · pricing · docs</span>
          </div>
          <div style={{ marginTop: 90, position: "relative", display: "inline-block" }}>
            <div style={{ fontSize, fontWeight: 650, letterSpacing: "-0.04em", lineHeight: 1, color: headColor }}>ship faster.</div>
            <div style={{ position: "absolute", inset: -6, border: `2px solid ${SELECT}`, opacity: outline, transform: `scale(${0.98 + 0.02 * outline})` }} />
            {selected > 0.5 ? <div style={{ position: "absolute", top: -32, left: -6, background: SELECT, color: "#fff", fontSize: 12, padding: "3px 8px", borderRadius: 4 }}>h1</div> : null}
          </div>
          <p style={{ fontSize: 17, color: "#555", maxWidth: 420, lineHeight: 1.45, marginTop: 22 }}>The workspace for teams who would rather build than wait.</p>
          <div style={{ display: "inline-block", marginTop: 10, background: "#111", color: "#fff", padding: "12px 20px", borderRadius: 999, fontSize: 15 }}>get started</div>
        </div>
      </div>

      <div style={{ width: 260, borderLeft: `1px solid ${LINE}`, padding: "16px 16px", position: "relative" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", color: DIM, marginBottom: 12 }}>PROPERTIES</div>
        <div style={{ opacity: selected }}>
          <div style={{ fontSize: 13, color: DIM, margin: "6px 0" }}>Typography</div>
          <Row label="Font" value="Inter" />
          <Row label="Size" value={`${Math.round(fontSize)}`} active={scrubbing} />
          <Row label="Weight" value="650" />
          <div style={{ fontSize: 13, color: DIM, margin: "18px 0 6px" }}>Fill</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div data-swatch style={{ width: 28, height: 28, borderRadius: 6, background: headColor, border: "1px solid #444" }} />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{headColor.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, transform: `scale(${swatchOpen})`, transformOrigin: "top left" }}>
            {SWATCHES.map((c) => (
              <div key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, outline: c === headColor ? "2px solid #fff" : "none", outlineOffset: 2 }} />
            ))}
          </div>
          <div style={{ fontSize: 13, color: DIM, margin: "18px 0 6px" }}>Layout</div>
          <Row label="Margin" value="0 0 24" />
          <Row label="Align" value="left" />
        </div>
      </div>
    </div>
  );
};

export const CARD_GEOMETRY = {
  heading: { x: 300, y: 225 },
  sizeField: { x: 1020, y: 120 },
  swatch: { x: 875, y: 285 },
};
