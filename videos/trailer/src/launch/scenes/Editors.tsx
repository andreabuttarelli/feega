import { siVscodium, siWindsurf } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { lift, tween } from "../../ease";
import { MARKS, Mark, type BrandMark } from "../../components/brandIcons";
import { Align, Headline } from "../Headline";
import { Place, Section } from "../Section";
import { MONO, ORANGE, PAPER, Tone, UI } from "../style";

export const EDITORS_FRAMES = 120;
export const CONNECT_FROM = 34;
export const CONNECT_STEP = 9;

const BOX = "0 0 24 24";

const TILES: { name: string; mark?: BrandMark; color: string }[] = [
  { name: "VS Code", mark: MARKS.vscode, color: "#2f9cf4" },
  { name: "Cursor", mark: MARKS.cursor, color: PAPER },
  { name: "Windsurf", mark: { path: siWindsurf.path, viewBox: BOX }, color: PAPER },
  { name: "VSCodium", mark: { path: siVscodium.path, viewBox: BOX }, color: "#2f80ed" },
  { name: "npx feega", color: ORANGE },
];

export const Editors = () => {
  const frame = useCurrentFrame();

  return (
    <Section tone={Tone.Ink} eyebrow="06 · editors">
      <Place x={0} y={190} style={{ width: 1920 }}>
        <Headline lines={["works where you", "already code."]} boxed="already" tone={Tone.Ink} size={124} align={Align.Center} />
      </Place>
      <Place x={0} y={600} style={{ width: 1920, display: "flex", justifyContent: "center", gap: 28 }}>
        {TILES.map((tile, i) => {
          const p = lift(frame, 8 + i * 3, 12);
          const on = tween(frame, CONNECT_FROM + i * CONNECT_STEP, 6);

          return (
            <div key={tile.name} style={{ width: 300, height: 220, borderRadius: 18, background: "#1a1a19", border: `2px solid ${on > 0.5 ? ORANGE : "#2e2e2c"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: UI, color: PAPER, transform: `translateY(${(1 - p) * 140}px)`, opacity: p }}>
              {tile.mark ? <Mark mark={tile.mark} size={72} color={tile.color} /> : <div style={{ fontFamily: MONO, fontSize: 54, color: tile.color, height: 72, lineHeight: "72px" }}>&gt;_</div>}
              <div style={{ fontSize: 26, fontFamily: tile.mark ? UI : MONO }}>{tile.name}</div>
              <div style={{ fontSize: 18, color: ORANGE, display: "flex", alignItems: "center", gap: 8, opacity: on, transform: `scale(${0.6 + 0.4 * on})` }}>
                <span style={{ width: 10, height: 10, background: ORANGE }} />
                connected
              </div>
            </div>
          );
        })}
      </Place>
    </Section>
  );
};
