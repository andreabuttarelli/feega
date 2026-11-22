import type { CSSProperties } from "react";
import { SANS } from "../theme";

export type Post = {
  name: string;
  handle: string;
  age: string;
  text: string;
  hue: number;
  media: boolean;
  stats: [string, string, string, string];
};

const POSTS: Post[] = [
  { name: "Mara Lind", handle: "maralind", age: "2m", text: "shipping on a friday again. pray for me", hue: 200, media: false, stats: ["12", "4", "88", "3.1K"] },
  { name: "devon.exe", handle: "devon_exe", age: "8m", text: "hot take: tabs > spaces and I will not elaborate", hue: 30, media: false, stats: ["240", "51", "1.2K", "40K"] },
  { name: "Pixel Pete", handle: "pixelpete", age: "15m", text: "new wallpaper drop, which one?", hue: 280, media: true, stats: ["31", "12", "402", "9K"] },
  { name: "Juno Park", handle: "junopark", age: "21m", text: "my plant survived another week. growth mindset", hue: 120, media: false, stats: ["8", "1", "65", "1.4K"] },
  { name: "Founder Mode", handle: "foundermode_", age: "33m", text: "we raised a pre-seed for a pre-idea. AMA", hue: 340, media: false, stats: ["560", "88", "2.9K", "210K"] },
  { name: "Lena K.", handle: "lenakodes", age: "40m", text: "css grid finally clicked. it only took six years", hue: 170, media: false, stats: ["44", "19", "710", "22K"] },
  { name: "sunset dump", handle: "goldenhrs", age: "52m", text: "", hue: 20, media: true, stats: ["9", "30", "1.8K", "31K"] },
  { name: "Omar R", handle: "omar_builds", age: "1h", text: "day 47 of building in public: still no users", hue: 240, media: false, stats: ["71", "6", "530", "12K"] },
  { name: "Tess", handle: "tess_types", age: "1h", text: "coffee number four. send help", hue: 50, media: false, stats: ["3", "0", "42", "900"] },
  { name: "Neo Grid", handle: "neogrid", age: "2h", text: "dark mode is a personality", hue: 260, media: false, stats: ["120", "33", "1.1K", "38K"] },
];

export const HOOK: Post = {
  name: "Chad Visionary",
  handle: "ai_10x_chad",
  age: "1h",
  text: "Your AI can now replace a team of 100 designers 🤯\n\nPerfect UI. First try. Zero effort.",
  hue: 45,
  media: false,
  stats: ["12.4K", "48.1K", "391K", "18.2M"],
};

export const HOOK_INDEX = POSTS.length;

const AVATAR = 48;
const TEXT_LINE = 26;
const MEDIA = 260;
const POST_PAD = 32;
const ACTIONS = 44;
const HOOK_EXTRA = 0;

const postHeight = (post: Post) => {
  const lines = post.text ? post.text.split("\n").length : 0;

  return POST_PAD + 24 + lines * TEXT_LINE + (post.media ? MEDIA + 12 : 0) + ACTIONS + (post === HOOK ? HOOK_EXTRA : 0);
};

const FEED = [...POSTS, HOOK, ...POSTS.slice(0, 4)];

const tops = FEED.reduce<number[]>((acc, post, i) => [...acc, i === 0 ? 0 : acc[i - 1] + postHeight(FEED[i - 1])], []);

export const HOOK_HEIGHT = postHeight(HOOK);

export const HOOK_CENTER =tops[HOOK_INDEX] + postHeight(HOOK) / 2;

const Icon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = [
  "M4 5h16v10H9l-5 4z",
  "M7 4l-3 3 3 3M4 7h12a4 4 0 014 4M17 20l3-3-3-3M20 17H8a4 4 0 01-4-4",
  "M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z",
  "M5 20V11M12 20V4M19 20v-6",
];

const Avatar = ({ hue, size }: { hue: number; size: number }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      flexShrink: 0,
      background: `radial-gradient(circle at 50% 38%, hsl(${hue} 60% 78%) 0 22%, transparent 23%), radial-gradient(circle at 50% 100%, hsl(${hue} 60% 78%) 0 42%, transparent 43%), hsl(${hue} 45% 38%)`,
    }}
  />
);

export const PostCard = ({ post, scale = 1, liked = 0 }: { post: Post; scale?: number; liked?: number }) => {
  const big = post === HOOK;
  const fs = (n: number) => n * scale;

  return (
    <div style={{ display: "flex", gap: 12, padding: `${16 * scale}px ${16 * scale}px`, fontFamily: SANS, color: "#e7e9ea" }}>
      <Avatar hue={post.hue} size={AVATAR * scale} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: fs(15), display: "flex", gap: 6, alignItems: "center" }}>
          <b>{post.name}</b>
          {big && <span style={{ color: "#c08bff", fontSize: fs(15) }}>✦</span>}
          <span style={{ color: "#71767b" }}>
            @{post.handle} · {post.age}
          </span>
        </div>
        {post.text && (
          <div style={{ fontSize: fs(big ? 21 : 15), lineHeight: 1.3, marginTop: 4, whiteSpace: "pre-line", fontWeight: big ? 500 : 400 }}>{post.text}</div>
        )}
        {post.media && (
          <div
            style={{
              marginTop: 12,
              height: MEDIA * scale,
              borderRadius: 16,
              border: "1px solid #2f3336",
              background: `linear-gradient(160deg, hsl(${post.hue} 70% 55%), hsl(${post.hue + 60} 60% 22%))`,
            }}
          />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 * scale, color: "#71767b", fontSize: fs(13), maxWidth: 440 * scale }}>
          {ICONS.map((d, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, color: i === 2 && liked > 0.5 ? "#f91880" : undefined }}>
              <Icon d={d} />
              {post.stats[i]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const NAV = ["⌂", "⌕", "◔", "✉", "☰", "◯"];

const column: CSSProperties = { position: "absolute", top: 0, bottom: 0 };

type Props = {
  offset: number;
  blur: number;
  hideHook: boolean;
};

export const FEED_LEFT = 420;
export const FEED_WIDTH = 600;

export const Feed = ({ offset, blur, hideHook }: Props) => (
  <div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <filter id="scrollblur">
        <feGaussianBlur stdDeviation={`0 ${blur}`} />
      </filter>
    </svg>

    <div style={{ ...column, left: 300, width: 100, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 30, paddingTop: 24, paddingRight: 24, color: "#e7e9ea", fontSize: 26 }}>
      {NAV.map((n) => (
        <span key={n}>{n}</span>
      ))}
    </div>

    <div style={{ ...column, left: FEED_LEFT, width: FEED_WIDTH, borderLeft: "1px solid #2f3336", borderRight: "1px solid #2f3336" }}>
      <div style={{ position: "absolute", inset: 0, filter: blur > 0.3 ? "url(#scrollblur)" : undefined }}>
        <div style={{ transform: `translateY(${-offset}px)` }}>
          {FEED.map((post, i) => (
            <div key={i} style={{ height: postHeight(post), borderBottom: "1px solid #2f3336", opacity: hideHook && i === HOOK_INDEX ? 0 : 1 }}>
              <PostCard post={post} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 53, background: "rgba(0,0,0,0.8)", borderBottom: "1px solid #2f3336", display: "flex", fontFamily: SANS, fontSize: 15, color: "#71767b" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#e7e9ea", fontWeight: 700 }}>For you</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>Following</div>
      </div>
    </div>

    <div style={{ ...column, left: FEED_LEFT + FEED_WIDTH + 30, width: 300, paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ height: 42, borderRadius: 21, background: "#202327" }} />
      <div style={{ height: 300, borderRadius: 16, border: "1px solid #2f3336" }} />
    </div>
  </div>
);
