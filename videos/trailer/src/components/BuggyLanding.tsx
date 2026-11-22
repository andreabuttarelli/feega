import { SANS } from "../theme";

type Props = {
  navCenter: number;
  titleColor: string;
};

const NAV_LINKS = ["Home", "Product", "Pricing", "Blog"];
const FEATURES = ["Fast", "Secure", "Scalable"];

export const NAV_HEIGHT = 72;

export const BuggyLanding = ({ navCenter, titleColor }: Props) => (
  <div style={{ position: "absolute", inset: 0, fontFamily: SANS, color: "#111", background: "#fff" }}>
    <div style={{ position: "relative", height: NAV_HEIGHT, borderBottom: "1px solid #eee" }}>
      <div style={{ position: "absolute", left: 32, top: 22, fontWeight: 700, fontSize: 24, letterSpacing: "-0.03em" }}>
        Lumen
      </div>
      <div
        style={{
          position: "absolute",
          left: `${navCenter}%`,
          top: 26,
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
      <div style={{ position: "absolute", right: 28, top: 16, background: "#111", color: "#fff", fontSize: 15, padding: "10px 18px", borderRadius: 4 }}>
        Sign up
      </div>
    </div>

    <div style={{ padding: "64px 64px 0" }}>
      <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, color: titleColor }}>
        The best startup
        <br />
        website ever.
      </div>
      <div style={{ fontSize: 20, color: "#777", marginTop: 14, marginLeft: 9 }}>We do things. Fast. With AI.</div>
      <div style={{ display: "flex", gap: 10, marginTop: 30, alignItems: "flex-start" }}>
        <div style={{ background: "#2f6bff", color: "#fff", padding: "16px 30px", borderRadius: 999, fontSize: 18 }}>Get started</div>
        <div style={{ border: "2px solid #bbb", color: "#555", padding: "8px 14px", borderRadius: 2, fontSize: 14, marginTop: 9, fontFamily: "Georgia, serif" }}>
          Learn more
        </div>
      </div>
    </div>

    <div style={{ display: "flex", padding: "0 64px", marginTop: 50 }}>
      {FEATURES.map((f, i) => (
        <div
          key={f}
          style={{
            width: 220,
            height: 96,
            marginRight: i === 0 ? 8 : 46,
            borderRadius: 12,
            background: "#f4f4f6",
            padding: 18,
            fontSize: 18,
            fontWeight: 600,
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
        height: 64,
        borderTop: "1px solid #eee",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 22,
        paddingRight: 8,
        fontSize: 14,
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
