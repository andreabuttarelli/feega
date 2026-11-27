import type { ReactElement } from "react";

export enum Cat {
  Tabby = "tabby",
  Black = "black",
  Grey = "grey",
  Calico = "calico",
  White = "white",
  Siamese = "siamese",
  CoolBlack = "cool-black",
  CoolOrange = "cool-orange",
  HoodieOrange = "hoodie-orange",
}

enum Pattern {
  Plain = "plain",
  Stripes = "stripes",
  Patches = "patches",
  Mask = "mask",
}

enum Extra {
  None = "none",
  Sunglasses = "sunglasses",
  Hoodie = "hoodie",
}

type Look = { bg: string; fur: string; mark: string; ear: string; eye: string; pattern: Pattern; extra: Extra };

const PINK_EAR = "#f3a5b5";
const DARK_EAR = "#3a3a3e";

const LOOKS: Record<Cat, Look> = {
  [Cat.Tabby]: { bg: "#1d9bf0", fur: "#f2994a", mark: "#c4621b", ear: PINK_EAR, eye: "#3b2a12", pattern: Pattern.Stripes, extra: Extra.None },
  [Cat.Black]: { bg: "#7856ff", fur: "#232326", mark: "#232326", ear: DARK_EAR, eye: "#e8d44d", pattern: Pattern.Plain, extra: Extra.None },
  [Cat.Grey]: { bg: "#00ba7c", fur: "#9aa3ad", mark: "#6b737c", ear: PINK_EAR, eye: "#2f5d3a", pattern: Pattern.Stripes, extra: Extra.None },
  [Cat.Calico]: { bg: "#f91880", fur: "#fbf4ea", mark: "#e07b2e", ear: PINK_EAR, eye: "#2b2b2b", pattern: Pattern.Patches, extra: Extra.None },
  [Cat.White]: { bg: "#ffd400", fur: "#ffffff", mark: "#ffffff", ear: PINK_EAR, eye: "#4aa3df", pattern: Pattern.Plain, extra: Extra.None },
  [Cat.Siamese]: { bg: "#ff7a00", fur: "#f1e3cc", mark: "#5a3d2b", ear: "#5a3d2b", eye: "#3d8bfd", pattern: Pattern.Mask, extra: Extra.None },
  [Cat.CoolBlack]: { bg: "#ff5c5c", fur: "#232326", mark: "#232326", ear: DARK_EAR, eye: "#e8d44d", pattern: Pattern.Plain, extra: Extra.Sunglasses },
  [Cat.CoolOrange]: { bg: "#7856ff", fur: "#f2994a", mark: "#c4621b", ear: PINK_EAR, eye: "#3b2a12", pattern: Pattern.Stripes, extra: Extra.Sunglasses },
  [Cat.HoodieOrange]: { bg: "#1d9bf0", fur: "#f2994a", mark: "#c4621b", ear: PINK_EAR, eye: "#3b2a12", pattern: Pattern.Stripes, extra: Extra.Hoodie },
};

const Stripes = ({ look }: { look: Look }) => (
  <path d="M44 32v8M50 31v10M56 32v8M25 52h8M26 59h7M75 52h-8M74 59h-7" stroke={look.mark} strokeWidth="3" strokeLinecap="round" />
);

const Patches = ({ look }: { look: Look }) => (
  <>
    <path d="M25 46a25 25 0 0 1 21-17v20z" fill={look.mark} />
    <path d="M60 31a24 24 0 0 1 16 22l-14-3z" fill="#2b2b2b" />
  </>
);

const Mask = ({ look }: { look: Look }) => <ellipse cx="50" cy="60" rx="15" ry="12" fill={look.mark} opacity="0.85" />;

const MARKS: Record<Pattern, (props: { look: Look }) => ReactElement | null> = {
  [Pattern.Plain]: () => null,
  [Pattern.Stripes]: Stripes,
  [Pattern.Patches]: Patches,
  [Pattern.Mask]: Mask,
};

const Eyes = ({ look }: { look: Look }) => {
  if (look.extra === Extra.Sunglasses) {
    return (
      <>
        <path d="M28 48h44" stroke="#111" strokeWidth="3" />
        <rect x="30" y="45" width="17" height="11" rx="4" fill="#111" />
        <rect x="53" y="45" width="17" height="11" rx="4" fill="#111" />
        <path d="M33 48h6M56 48h6" stroke="#fff" strokeWidth="1.6" opacity="0.6" />
      </>
    );
  }

  return (
    <>
      <ellipse cx="40" cy="50" rx="4" ry="5" fill={look.eye} />
      <ellipse cx="60" cy="50" rx="4" ry="5" fill={look.eye} />
    </>
  );
};

export const CatAvatar = ({ cat, size }: { cat: Cat; size: number }) => {
  const look = LOOKS[cat];
  const Marks = MARKS[look.pattern];
  const hoodie = look.extra === Extra.Hoodie;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0, borderRadius: "50%" }}>
      <rect width="100" height="100" fill={look.bg} />
      {hoodie && <path d="M8 100c0-44 18-76 42-76s42 32 42 76z" fill="#2b2f36" />}
      <path d="M24 44L26 14l20 16z" fill={look.fur} />
      <path d="M76 44L74 14 54 30z" fill={look.fur} />
      <path d="M29 36l1-14 10 8z" fill={look.ear} />
      <path d="M71 36l-1-14-10 8z" fill={look.ear} />
      <ellipse cx="50" cy="54" rx="27" ry="24" fill={look.fur} />
      <Marks look={look} />
      <Eyes look={look} />
      <path d="M47 60h6l-3 3z" fill="#f08aa0" />
      <path d="M50 63q-3 4-7 2M50 63q3 4 7 2" stroke="#3a2a2a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {hoodie && <path d="M18 100c4-14 16-22 32-22s28 8 32 22z" fill="#3a404a" />}
    </svg>
  );
};
