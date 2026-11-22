import { mix } from "../ease";
import { SANS } from "../theme";

export type Glitches = {
  button: number;
  image: number;
  font: number;
};

type Props = {
  navCenter: number;
  titleColor: string;
  glitches: Glitches;
};

const NAV_LINKS = ["Home", "Product", "Pricing", "Blog"];
const FEATURES = ["⚡ Fast", "🔒 Secure", "📈 Scalable"];
const LOGO_WIDTHS = [70, 120, 48, 96, 150];
const COMIC = '"Comic Sans MS", "Chalkboard SE", cursive';
const SERIF = '"Times New Roman", Times, serif';
const HERO = "linear-gradient(120deg, #b8a4ff 0%, #ffb3e6 55%, #ffd59a 100%)";

export const NAV_HEIGHT = 64;

const BrokenImage = ({ shift }: { shift: number }) => (
  <div
    style={{
      position: "absolute",
      right: 40,
      top: 96,
      width: 270,
      height: 196,
      transform: `translateX(${-230 * shift}px) rotate(${-3 * shift}deg)`,
      background: "#f3f3f3",
      border: "2px dashed #b9b9b9",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      color: "#999",
      fontSize: 14,
      fontFamily: "Arial, sans-serif",
    }}
  >
    <svg width="44" height="40" viewBox="0 0 44 40">
      <path d="M2 2h40v36H2z" fill="none" stroke="#aaa" strokeWidth="3" />
      <path d="M2 30l12-12 10 10 6-6 12 12" fill="none" stroke="#aaa" strokeWidth="3" />
      <path d="M30 2l-6 14 8 6-6 16" fill="none" stroke="#f3f3f3" strokeWidth="5" />
    </svg>
    hero-final-v2 (1).png
  </div>
);

const TrustedBy = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "0 54px", marginTop: 22 }}>
    <div style={{ fontFamily: "Courier New, monospace", fontSize: 13, color: "#999", letterSpacing: "0.2em" }}>TRUSTED BY</div>
    {LOGO_WIDTHS.map((w, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.45, marginTop: i === 2 ? 14 : 0 }}>
        <div style={{ width: i === 4 ? 30 : 18, height: i === 4 ? 30 : 18, borderRadius: i % 2 ? 4 : 999, background: "#777" }} />
        <div style={{ width: w, height: i === 4 ? 16 : 10, borderRadius: 3, background: "#888" }} />
      </div>
    ))}
  </div>
);

export const BuggyLanding = ({ navCenter, titleColor, glitches }: Props) => (
  <div style={{ position: "absolute", inset: 0, fontFamily: SANS, color: "#111", background: "#fff", overflow: "hidden" }}>
    <div style={{ position: "relative", height: NAV_HEIGHT, borderBottom: "1px solid #eee", zIndex: 2 }}>
      <div style={{ position: "absolute", left: 28, top: 18, fontWeight: 800, fontSize: 24, fontFamily: "Impact, sans-serif", letterSpacing: "0.02em" }}>
        Lumen✨
      </div>
      <div
        style={{
          position: "absolute",
          left: `${navCenter}%`,
          top: 22,
          transform: "translateX(-50%)",
          display: "flex",
          gap: 30,
          fontSize: 17,
          color: "#444",
          whiteSpace: "nowrap",
        }}
      >
        {NAV_LINKS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 24,
          top: 12,
          background: "#111",
          color: "#fff",
          fontSize: 15,
          padding: "10px 18px",
          borderRadius: 4,
          transform: `translate(${-60 * glitches.button}px, ${150 * glitches.button}px) rotate(${-9 * glitches.button}deg)`,
        }}
      >
        Sign up
      </div>
    </div>

    <div style={{ position: "relative", height: 330, background: HERO, padding: "40px 54px 0" }}>
      <div
        style={{
          position: "absolute",
          left: 380,
          top: -12,
          background: "#00e676",
          color: "#003",
          fontSize: 13,
          fontWeight: 700,
          padding: "5px 12px",
          borderRadius: 999,
          transform: "rotate(6deg)",
          zIndex: 3,
        }}
      >
        NEW ✨ AI-powered
      </div>
      <div
        style={{
          position: "relative",
          fontSize: mix(52, 70, glitches.font),
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1.02,
          color: titleColor,
          fontFamily: glitches.font > 0.5 ? SERIF : SANS,
          transform: `translateX(${-24 * glitches.font}px)`,
          zIndex: 1,
        }}
      >
        🚀 The best startup
        <br />
        website ever 🔥
      </div>
      <div style={{ fontSize: 20, color: "#7a2bbf", marginTop: 14, marginLeft: 9, fontFamily: COMIC }}>We do things. Fast. With AI. 💯</div>
      <div style={{ display: "flex", gap: 10, marginTop: 26, alignItems: "flex-start" }}>
        <div style={{ background: "#2f6bff", color: "#fff", padding: "16px 30px", borderRadius: 999, fontSize: 18, fontWeight: 700 }}>Get started 🚀</div>
        <div style={{ border: "2px solid #ddd", color: "#fff", padding: "6px 12px", borderRadius: 0, fontSize: 13, marginTop: 14, fontFamily: SERIF }}>
          Learn more
        </div>
      </div>
      <BrokenImage shift={glitches.image} />
    </div>

    <TrustedBy />

    <div style={{ display: "flex", padding: "0 54px", marginTop: 20 }}>
      {FEATURES.map((f, i) => (
        <div
          key={f}
          style={{
            width: 230,
            height: 80,
            marginLeft: i === 1 ? -40 : i === 2 ? 60 : 0,
            marginTop: i === 1 ? 18 : 0,
            borderRadius: [12, 0, 28][i],
            background: ["#f4f4f6", "#fff3b0", "#e8f0ff"][i],
            border: i === 1 ? "2px solid #333" : "none",
            padding: 16,
            fontSize: 18,
            fontWeight: 600,
            fontFamily: i === 2 ? COMIC : SANS,
          }}
        >
          {f}
        </div>
      ))}
    </div>

    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 44,
        borderTop: "1px solid #eee",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 6,
        paddingRight: 2,
        fontSize: 13,
        color: "#888",
      }}
    >
      <span>© 2026 Lumen</span>
      <span>Privacy</span>
      <span>Terms</span>
      <span>Contact</span>
    </div>
  </div>
);
